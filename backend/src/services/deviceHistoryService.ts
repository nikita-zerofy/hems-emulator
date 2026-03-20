import { DateTime } from 'luxon';
import { query } from '../config/database';
import { DailyEnergySummary, DeviceHistoryDatapoint, DeviceHistorySeries, DeviceTypeValue } from '../types';

type SummaryTotalsRow = {
  solar_production_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  battery_charge_kwh: number;
  battery_discharge_kwh: number;
  household_consumption_kwh: number;
};

type DailySummaryRow = {
  dwelling_id: string;
  summary_date: string;
  solar_production_kwh: number;
  grid_import_kwh: number;
  grid_export_kwh: number;
  battery_charge_kwh: number;
  battery_discharge_kwh: number;
  household_consumption_kwh: number;
};

type DeviceHistoryRow = {
  device_id: string;
  dwelling_id: string;
  device_type: DeviceTypeValue;
  recorded_at: string;
  power_w: number;
  soc: number | null;
  is_charging: boolean | null;
  temperature_c: number | null;
  device_name?: string | null;
};

export class DeviceHistoryService {
  /**
   * Record a 15-minute snapshot for all devices from current device state.
   */
  static async recordDatapoints(recordedAt: Date = new Date()): Promise<number> {
    const result = await query(
      `INSERT INTO device_history (device_id, dwelling_id, device_type, recorded_at, power_w, soc, is_charging, temperature_c)
       SELECT d.device_id,
              d.dwelling_id,
              d.device_type,
              $1,
              CASE
                WHEN d.device_type = 'hotWaterStorage' THEN COALESCE((d.state->>'power')::real, 0)
                ELSE COALESCE((d.state->>'powerW')::real, 0)
              END AS power_w,
              CASE
                WHEN d.device_type IN ('battery', 'ev') THEN (d.state->>'batteryLevel')::real
                ELSE NULL
              END AS soc,
              CASE
                WHEN d.device_type IN ('battery', 'ev', 'evCharger') THEN (d.state->>'isCharging')::boolean
                ELSE NULL
              END AS is_charging,
              CASE
                WHEN d.device_type = 'battery' THEN (d.state->>'temperatureC')::real
                WHEN d.device_type = 'hotWaterStorage' THEN (d.state->>'waterTemperatureC')::real
                ELSE NULL
              END AS temperature_c
       FROM devices d`,
      [recordedAt.toISOString()]
    );

    return result.rowCount ?? 0;
  }

  /**
   * Return granular history rows for a specific device.
   */
  static async getDeviceHistory(
    deviceId: string,
    from: Date,
    to: Date,
    limit: number
  ): Promise<DeviceHistoryDatapoint[]> {
    const result = await query(
      `SELECT device_id, dwelling_id, device_type, recorded_at, power_w, soc, is_charging, temperature_c
       FROM device_history
       WHERE device_id = $1
         AND recorded_at >= $2
         AND recorded_at <= $3
       ORDER BY recorded_at ASC
       LIMIT $4`,
      [deviceId, from.toISOString(), to.toISOString(), limit]
    );

    return result.rows.map((row) => this.mapHistoryRow(row as DeviceHistoryRow));
  }

  /**
   * Return grouped history rows for all devices in a dwelling.
   */
  static async getDwellingHistory(
    dwellingId: string,
    from: Date,
    to: Date
  ): Promise<DeviceHistorySeries[]> {
    const result = await query(
      `SELECT h.device_id,
              h.dwelling_id,
              h.device_type,
              h.recorded_at,
              h.power_w,
              h.soc,
              h.is_charging,
              h.temperature_c,
              d.name AS device_name
       FROM device_history h
       INNER JOIN devices d ON d.device_id = h.device_id
       WHERE h.dwelling_id = $1
         AND h.recorded_at >= $2
         AND h.recorded_at <= $3
       ORDER BY h.device_id ASC, h.recorded_at ASC`,
      [dwellingId, from.toISOString(), to.toISOString()]
    );

    const grouped = new Map<string, DeviceHistorySeries>();
    for (const rawRow of result.rows) {
      const row = rawRow as DeviceHistoryRow;
      const datapoint = this.mapHistoryRow(row);
      const existing = grouped.get(row.device_id);
      if (existing) {
        existing.datapoints.push(datapoint);
        continue;
      }

      grouped.set(row.device_id, {
        deviceId: row.device_id,
        deviceType: row.device_type,
        deviceName: row.device_name ?? null,
        datapoints: [datapoint]
      });
    }

    return [...grouped.values()];
  }

  /**
   * Generate and persist a daily summary for a dwelling and local date.
   */
  static async generateDailySummary(
    dwellingId: string,
    summaryDate: string,
    timeZone: string
  ): Promise<DailyEnergySummary> {
    const dayStartUtc = DateTime.fromISO(summaryDate, { zone: timeZone }).startOf('day').toUTC();
    const dayEndUtc = dayStartUtc.plus({ days: 1 });

    const totalsResult = await query(
      `WITH history_with_config AS (
         SELECT h.device_type, h.power_w, d.config
         FROM device_history h
         INNER JOIN devices d ON d.device_id = h.device_id
         WHERE h.dwelling_id = $1
           AND h.recorded_at >= $2
           AND h.recorded_at < $3
       )
       SELECT
         COALESCE(SUM(CASE
           WHEN device_type = 'solarInverter'
             THEN GREATEST(power_w, 0) * 0.25 / 1000
           ELSE 0
         END), 0) AS solar_production_kwh,
         COALESCE(SUM(CASE
           WHEN device_type = 'meter'
             AND COALESCE(config->>'role', 'grid') = 'grid'
             AND power_w > 0
             THEN power_w * 0.25 / 1000
           ELSE 0
         END), 0) AS grid_import_kwh,
         COALESCE(SUM(CASE
           WHEN device_type = 'meter'
             AND COALESCE(config->>'role', 'grid') = 'grid'
             AND power_w < 0
             THEN -power_w * 0.25 / 1000
           ELSE 0
         END), 0) AS grid_export_kwh,
         COALESCE(SUM(CASE
           WHEN device_type = 'battery'
             AND power_w > 0
             THEN power_w * 0.25 / 1000
           ELSE 0
         END), 0) AS battery_charge_kwh,
         COALESCE(SUM(CASE
           WHEN device_type = 'battery'
             AND power_w < 0
             THEN -power_w * 0.25 / 1000
           ELSE 0
         END), 0) AS battery_discharge_kwh,
         COALESCE(SUM(CASE
           WHEN device_type IN ('ev', 'evCharger', 'hotWaterStorage')
             AND power_w > 0
             THEN power_w * 0.25 / 1000
           WHEN device_type = 'appliance'
             AND COALESCE(config->>'role', 'consumption') = 'consumption'
             AND power_w > 0
             THEN power_w * 0.25 / 1000
           ELSE 0
         END), 0) AS household_consumption_kwh
       FROM history_with_config`,
      [dwellingId, dayStartUtc.toISO(), dayEndUtc.toISO()]
    );

    const totals = totalsResult.rows[0] as SummaryTotalsRow;
    return this.saveDailySummary(dwellingId, summaryDate, {
      dwellingId,
      summaryDate,
      solarProductionKwh: totals.solar_production_kwh,
      gridImportKwh: totals.grid_import_kwh,
      gridExportKwh: totals.grid_export_kwh,
      batteryChargeKwh: totals.battery_charge_kwh,
      batteryDischargeKwh: totals.battery_discharge_kwh,
      householdConsumptionKwh: totals.household_consumption_kwh
    });
  }

  /**
   * Upsert a daily energy summary.
   */
  static async saveDailySummary(
    dwellingId: string,
    summaryDate: string,
    summary: DailyEnergySummary
  ): Promise<DailyEnergySummary> {
    const result = await query(
      `INSERT INTO daily_energy_summary (
         dwelling_id,
         summary_date,
         solar_production_kwh,
         grid_import_kwh,
         grid_export_kwh,
         battery_charge_kwh,
         battery_discharge_kwh,
         household_consumption_kwh
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (dwelling_id, summary_date)
       DO UPDATE SET
         solar_production_kwh = EXCLUDED.solar_production_kwh,
         grid_import_kwh = EXCLUDED.grid_import_kwh,
         grid_export_kwh = EXCLUDED.grid_export_kwh,
         battery_charge_kwh = EXCLUDED.battery_charge_kwh,
         battery_discharge_kwh = EXCLUDED.battery_discharge_kwh,
         household_consumption_kwh = EXCLUDED.household_consumption_kwh
       RETURNING dwelling_id,
                 summary_date,
                 solar_production_kwh,
                 grid_import_kwh,
                 grid_export_kwh,
                 battery_charge_kwh,
                 battery_discharge_kwh,
                 household_consumption_kwh`,
      [
        dwellingId,
        summaryDate,
        summary.solarProductionKwh,
        summary.gridImportKwh,
        summary.gridExportKwh,
        summary.batteryChargeKwh,
        summary.batteryDischargeKwh,
        summary.householdConsumptionKwh
      ]
    );

    return this.mapSummaryRow(result.rows[0] as DailySummaryRow);
  }

  /**
   * Return daily summaries for a date range.
   */
  static async getDailySummaries(
    dwellingId: string,
    from: string,
    to: string
  ): Promise<DailyEnergySummary[]> {
    const result = await query(
      `SELECT dwelling_id,
              summary_date,
              solar_production_kwh,
              grid_import_kwh,
              grid_export_kwh,
              battery_charge_kwh,
              battery_discharge_kwh,
              household_consumption_kwh
       FROM daily_energy_summary
       WHERE dwelling_id = $1
         AND summary_date >= $2
         AND summary_date <= $3
       ORDER BY summary_date ASC`,
      [dwellingId, from, to]
    );

    return result.rows.map((row) => this.mapSummaryRow(row as DailySummaryRow));
  }

  /**
   * Delete detailed history older than the retention window.
   */
  static async cleanupOldHistory(): Promise<number> {
    const result = await query(
      `DELETE FROM device_history
       WHERE recorded_at < NOW() - INTERVAL '2 days'`
    );
    return result.rowCount ?? 0;
  }

  private static mapHistoryRow(row: DeviceHistoryRow): DeviceHistoryDatapoint {
    return {
      deviceId: row.device_id,
      dwellingId: row.dwelling_id,
      deviceType: row.device_type,
      recordedAt: row.recorded_at,
      powerW: row.power_w,
      soc: row.soc,
      isCharging: row.is_charging,
      temperatureC: row.temperature_c
    };
  }

  private static mapSummaryRow(row: DailySummaryRow): DailyEnergySummary {
    return {
      dwellingId: row.dwelling_id,
      summaryDate: row.summary_date,
      solarProductionKwh: row.solar_production_kwh,
      gridImportKwh: row.grid_import_kwh,
      gridExportKwh: row.grid_export_kwh,
      batteryChargeKwh: row.battery_charge_kwh,
      batteryDischargeKwh: row.battery_discharge_kwh,
      householdConsumptionKwh: row.household_consumption_kwh
    };
  }
}
