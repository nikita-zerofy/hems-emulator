import { Router, Request, Response } from 'express';
import { DateTime } from 'luxon';
import { authenticateInternalJob } from '../middleware/internalJobAuth';
import { SimulationEngine } from '../services/simulationEngine';
import { SchedulerService } from '../services/schedulerService';

const router = Router();
router.use(authenticateInternalJob);

/**
 * POST /internal/jobs/simulate
 * Execute one simulation cycle.
 */
router.post('/simulate', async (_req: Request, res: Response) => {
  try {
    const executed = await SimulationEngine.getInstance().runCycleOnce();
    return res.status(200).json({
      success: true,
      job: 'simulate',
      executed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      job: 'simulate',
      error: error instanceof Error ? error.message : 'Failed to execute simulation job'
    });
  }
});

/**
 * POST /internal/jobs/history-snapshot
 * Record one normalized 15-minute history snapshot.
 */
router.post('/history-snapshot', async (_req: Request, res: Response) => {
  try {
    const scheduler = SchedulerService.getInstance();
    const insertedRows = await scheduler.recordHistorySnapshot();
    return res.status(200).json({
      success: true,
      job: 'history-snapshot',
      insertedRows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      job: 'history-snapshot',
      error: error instanceof Error ? error.message : 'Failed to run history snapshot job'
    });
  }
});

/**
 * POST /internal/jobs/history-cleanup
 * Cleanup old history rows beyond retention.
 */
router.post('/history-cleanup', async (_req: Request, res: Response) => {
  try {
    const scheduler = SchedulerService.getInstance();
    const deletedRows = await scheduler.cleanupHistory();
    return res.status(200).json({
      success: true,
      job: 'history-cleanup',
      deletedRows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      job: 'history-cleanup',
      error: error instanceof Error ? error.message : 'Failed to run history cleanup job'
    });
  }
});

/**
 * POST /internal/jobs/daily-summary
 * Generate daily summaries for dwellings where local time is midnight.
 */
router.post('/daily-summary', async (_req: Request, res: Response) => {
  try {
    const scheduler = SchedulerService.getInstance();
    const generatedSummaries = await scheduler.generateDailySummariesAtLocalMidnight(DateTime.now());
    return res.status(200).json({
      success: true,
      job: 'daily-summary',
      generatedSummaries,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      job: 'daily-summary',
      error: error instanceof Error ? error.message : 'Failed to run daily summary job'
    });
  }
});

export default router;
