import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { DailyEnergySummary } from '../types';

type DwellingEnergyOverviewProps = {
  summaries: DailyEnergySummary[];
};

const DwellingEnergyOverview: React.FC<DwellingEnergyOverviewProps> = ({ summaries }) => {
  const data = summaries.map((summary) => ({
    date: summary.summaryDate,
    solarProductionKwh: summary.solarProductionKwh,
    gridImportKwh: summary.gridImportKwh,
    gridExportKwh: summary.gridExportKwh,
    batteryChargeKwh: summary.batteryChargeKwh,
    batteryDischargeKwh: summary.batteryDischargeKwh,
    householdConsumptionKwh: summary.householdConsumptionKwh
  }));

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">Daily Energy Overview</h2>
      </div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="solarProductionKwh" stackId="energy" fill="#f59e0b" name="Solar Production" />
            <Bar dataKey="gridImportKwh" stackId="energy" fill="#ef4444" name="Grid Import" />
            <Bar dataKey="gridExportKwh" stackId="energy" fill="#22c55e" name="Grid Export" />
            <Bar dataKey="batteryChargeKwh" stackId="energy" fill="#3b82f6" name="Battery Charge" />
            <Bar dataKey="batteryDischargeKwh" stackId="energy" fill="#8b5cf6" name="Battery Discharge" />
            <Bar dataKey="householdConsumptionKwh" stackId="energy" fill="#6366f1" name="Consumption" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DwellingEnergyOverview;
