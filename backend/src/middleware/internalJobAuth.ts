import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

const InternalJobSecretHeader = 'x-internal-job-secret';

/**
 * Authenticate internal scheduler job calls using a shared secret header.
 */
export const authenticateInternalJob = (req: Request, res: Response, next: NextFunction): void => {
  const expectedSecret = process.env.INTERNAL_JOB_SECRET;
  if (!expectedSecret) {
    logger.error('INTERNAL_JOB_SECRET is not configured');
    res.status(500).json({
      success: false,
      error: 'Internal job authentication is not configured'
    });
    return;
  }

  const providedSecret = req.header(InternalJobSecretHeader);
  if (!providedSecret || providedSecret !== expectedSecret) {
    logger.warn({
      path: req.path,
      method: req.method
    }, 'Unauthorized internal job request');
    res.status(401).json({
      success: false,
      error: 'Unauthorized internal job request'
    });
    return;
  }

  next();
};
