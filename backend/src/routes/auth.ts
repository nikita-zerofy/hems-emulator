import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { ApiResponse } from '../types';
import { z } from 'zod';

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
    const { email, password } = RegisterSchema.parse(req.body);
    
    const result = await AuthService.register(email, password);
    
    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'User registered successfully'
    };
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    };
    
    // Check if it's a validation error
    if (error instanceof z.ZodError) {
      response.error = 'Invalid input data';
      response.data = error.errors;
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
    const { email, password } = LoginSchema.parse(req.body);
    
    const result = await AuthService.login(email, password);
    
    const response: ApiResponse = {
      success: true,
      data: result,
      message: 'Login successful'
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Login error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    };
    
    // Check if it's a validation error
    if (error instanceof z.ZodError) {
      response.error = 'Invalid input data';
      response.data = error.errors;
    }
    
    res.status(401).json(response);
  }
});

export default router; 