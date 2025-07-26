import { Request, Response, NextFunction } from 'express';
import { ZerofyService } from '../services/zerofyService';

// Extend Express Request type to include Zerofy user info
declare global {
  namespace Express {
    interface Request {
      zerofyUser?: {
        userId: string;
        clientId: string;
        scope: string;
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
    
    // Verify it's a Zerofy API token
    if (decoded.type !== 'zerofy_api') {
      throw new Error('Invalid token type');
    }

    req.zerofyUser = {
      userId: decoded.userId,
      clientId: decoded.clientId,
      scope: decoded.scope
    };
    
    next();
  } catch (error) {
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

/**
 * Middleware to check if the token has required scopes
 */
export const requireZerofyScope = (requiredScope: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.zerofyUser) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    const userScopes = req.zerofyUser.scope.split(' ');
    
    if (!userScopes.includes(requiredScope)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_SCOPE',
          message: `Required scope '${requiredScope}' not granted`
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      });
      return;
    }

    next();
  };
}; 