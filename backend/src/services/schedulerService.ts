import cron, { ScheduledTask } from 'node-cron';
import { DateTime } from 'luxon';
import { query } from '../config/database';
import { logger } from '../config/logger';
import { DeviceHistoryService } from './deviceHistoryService';

type DwellingTimezoneRow = {
  dwelling_id: string;
  time_zone: string;
};

export class SchedulerService {
  private static instance: SchedulerService;
  private datapointTask?: ScheduledTask;
  private summaryTask?: ScheduledTask;
  private cleanupTask?: ScheduledTask;
  private isRunning = false;

  private constructor() {}

  static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }

  /**
   * Start all scheduled jobs used by history features.
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler service is already running');
      return;
    }

    this.datapointTask = cron.schedule('*/15 * * * *', async () => {
      try {
        const insertedRows = await this.recordHistorySnapshot();
        logger.info({ insertedRows }, 'Recorded 15-minute device history datapoints');
      } catch (error) {
        logger.error({ error }, 'Failed to record 15-minute device history datapoints');
      }
    });

    this.summaryTask = cron.schedule('*/15 * * * *', async () => {
      try {
        const generatedSummaries = await this.generateDailySummariesAtLocalMidnight();
        logger.info({ generatedSummaries }, 'Completed daily summary generation check');
      } catch (error) {
        logger.error({ error }, 'Failed to generate daily summaries');
      }
    });

    this.cleanupTask = cron.schedule('0 * * * *', async () => {
      try {
        const deletedRows = await this.cleanupHistory();
        logger.info({ deletedRows }, 'Cleaned up old device history rows');
      } catch (error) {
        logger.error({ error }, 'Failed to clean up old device history rows');
      }
    });

    this.isRunning = true;
    logger.info('Scheduler service started');
  }

  /**
   * Stop all scheduled jobs.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.datapointTask?.stop();
    this.summaryTask?.stop();
    this.cleanupTask?.stop();

    this.datapointTask = undefined;
    this.summaryTask = undefined;
    this.cleanupTask = undefined;
    this.isRunning = false;

    logger.info('Scheduler service stopped');
  }

  /**
   * Record one history snapshot batch.
   */
  async recordHistorySnapshot(recordedAt?: Date): Promise<number> {
    return DeviceHistoryService.recordDatapoints(recordedAt);
  }

  /**
   * Delete old history rows based on retention policy.
   */
  async cleanupHistory(): Promise<number> {
    return DeviceHistoryService.cleanupOldHistory();
  }

  /**
   * Generate daily summaries for dwellings where local time is midnight.
   */
  async generateDailySummariesAtLocalMidnight(now: DateTime = DateTime.now()): Promise<number> {
    const dwellings = await this.getAllDwellingsWithTimeZone();
    let generatedCount = 0;
    for (const dwelling of dwellings) {
      const localNow = now.setZone(dwelling.time_zone);
      if (localNow.hour !== 0 || localNow.minute !== 0) {
        continue;
      }

      const summaryDate = localNow.minus({ days: 1 }).toISODate();
      if (!summaryDate) {
        continue;
      }

      await DeviceHistoryService.generateDailySummary(
        dwelling.dwelling_id,
        summaryDate,
        dwelling.time_zone
      );

      logger.info(
        {
          dwellingId: dwelling.dwelling_id,
          summaryDate,
          timeZone: dwelling.time_zone
        },
        'Generated daily energy summary'
      );
      generatedCount += 1;
    }

    return generatedCount;
  }

  /**
   * Fetch all dwellings with their configured time zones.
   */
  private async getAllDwellingsWithTimeZone(): Promise<DwellingTimezoneRow[]> {
    const result = await query(
      `SELECT dwelling_id, time_zone
       FROM dwellings`
    );

    return result.rows.map((row) => ({
      dwelling_id: row.dwelling_id as string,
      time_zone: row.time_zone as string
    }));
  }
}
