import { Request, Response, NextFunction } from 'express';
import { ZerofyService } from '../services/zerofyService';

// Extend Express Request type to include Zerofy user info
declare global {
  namespace Express {
    interface Request {
      zerofyUser?: {
        userId: string;
      };
    }
  }
}

/**
 * Middleware to authenticate Zerofy API requests using Bearer tokens
 */
export const authenticateZerofyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access token required'
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
    return;
  }

  try {
    const decoded = ZerofyService.verifyZerofyToken(token);
    req.zerofyUser = {
      userId: decoded.userId,
    };
    
    next();
  } catch (error) {
    console.error(error);
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired access token'
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
  }
};
