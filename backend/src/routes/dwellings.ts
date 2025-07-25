import { Router, Request, Response } from 'express';
import { DwellingService } from '../services/dwellingService';
import { DeviceService } from '../services/deviceService';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse, LocationSchema } from '../types';
import { z } from 'zod';

const router = Router();

// All dwelling routes require authentication
router.use(authenticateToken);

// Request validation schemas
const CreateDwellingSchema = z.object({
  timeZone: z.string(),
  location: LocationSchema
});

/**
 * POST /dwellings
 * Create a new dwelling for the authenticated user
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } satisfies ApiResponse);
    }

    const { timeZone, location } = CreateDwellingSchema.parse(req.body);
    
    const dwelling = await DwellingService.createDwelling(
      req.user.userId,
      timeZone,
      location
    );
    
    const response: ApiResponse = {
      success: true,
      data: dwelling,
      message: 'Dwelling created successfully'
    };
    
    return res.status(201).json(response);
  } catch (error) {
    console.error('Create dwelling error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create dwelling'
    };
    
    if (error instanceof z.ZodError) {
      response.error = 'Invalid input data';
      response.data = error.errors;
    }
    
    return res.status(400).json(response);
  }
});

/**
 * GET /dwellings
 * Get all dwellings for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } satisfies ApiResponse);
    }

    const dwellings = await DwellingService.getUserDwellings(req.user.userId);
    
    const response: ApiResponse = {
      success: true,
      data: dwellings
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Get dwellings error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve dwellings'
    };
    
    return res.status(500).json(response);
  }
});

/**
 * GET /dwellings/:dwellingId
 * Get dwelling details with devices
 */
router.get('/:dwellingId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } satisfies ApiResponse);
    }

    const { dwellingId } = req.params;
    
    const dwelling = await DwellingService.getDwelling(dwellingId, req.user.userId);
    if (!dwelling) {
      return res.status(404).json({
        success: false,
        error: 'Dwelling not found'
      } satisfies ApiResponse);
    }

    // Get devices for this dwelling
    const devices = await DeviceService.getDwellingDevices(dwellingId);
    
    const response: ApiResponse = {
      success: true,
      data: {
        ...dwelling,
        devices
      }
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Get dwelling error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve dwelling'
    };
    
    return res.status(500).json(response);
  }
});

/**
 * PUT /dwellings/:dwellingId
 * Update dwelling information
 */
router.put('/:dwellingId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } satisfies ApiResponse);
    }

    const { dwellingId } = req.params;
    const updates = CreateDwellingSchema.partial().parse(req.body);
    
    const dwelling = await DwellingService.updateDwelling(dwellingId, req.user.userId, updates);
    if (!dwelling) {
      return res.status(404).json({
        success: false,
        error: 'Dwelling not found'
      } satisfies ApiResponse);
    }
    
    const response: ApiResponse = {
      success: true,
      data: dwelling,
      message: 'Dwelling updated successfully'
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Update dwelling error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update dwelling'
    };
    
    if (error instanceof z.ZodError) {
      response.error = 'Invalid input data';
      response.data = error.errors;
    }
    
    return res.status(400).json(response);
  }
});

/**
 * DELETE /dwellings/:dwellingId
 * Delete a dwelling and all its devices
 */
router.delete('/:dwellingId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      } satisfies ApiResponse);
    }

    const { dwellingId } = req.params;
    
    const deleted = await DwellingService.deleteDwelling(dwellingId, req.user.userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Dwelling not found'
      } satisfies ApiResponse);
    }
    
    const response: ApiResponse = {
      success: true,
      message: 'Dwelling deleted successfully'
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Delete dwelling error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete dwelling'
    };
    
    return res.status(500).json(response);
  }
});

export default router; 