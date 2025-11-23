import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { ApiResponse } from '../types';
import { z } from 'zod';
import { logger } from '../config/logger';

const router = Router();

// Request validation schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

/**
 * POST /auth/register
 * Create a new user account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    logger.info({ email: req.body.email }, 'User registration attempt');
    
    const { email, password } = RegisterSchema.parse(req.body);
    
    const result = await AuthService.register(email, password);
    
    logger.info({ 
      userId: result.user.userId, 
      email: result.user.email 
    }, 'User registered successfully');
    
    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'User registered successfully'
    };
    
    res.status(201).json(response);
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      email: req.body.email 
    }, 'Registration failed');
    
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    };
    
    // Check if it's a validation error
    if (error instanceof z.ZodError) {
      response.error = 'Invalid input data';
      response.data = error.errors;
      logger.warn({ validationErrors: error.errors }, 'Registration validation failed');
    }
    
    res.status(400).json(response);
  }
});

/**
 * POST /auth/login
 * Authenticate and receive a JSON Web Token (JWT)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    logger.info({ email: req.body.email }, 'User login attempt');
    
    const { email, password } = LoginSchema.parse(req.body);
    
    const result = await AuthService.login(email, password);
    
    logger.info({ 
      userId: result.user.userId, 
      email: result.user.email 
    }, 'User logged in successfully');
    
    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Login successful'
    };
    
    res.status(200).json(response);
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      email: req.body.email 
    }, 'Login failed');
    
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    };
    
    // Check if it's a validation error
    if (error instanceof z.ZodError) {
      response.error = 'Invalid input data';
      response.data = error.errors;
      logger.warn({ validationErrors: error.errors }, 'Login validation failed');
    }
    
    res.status(401).json(response);
  }
});

export default router; 