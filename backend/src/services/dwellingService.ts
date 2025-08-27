// @ts-types="npm:@types/uuid@9.0.7"
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.ts';
import { Dwelling, DwellingSchema, Location } from '../types/index.ts';

export class DwellingService {
  /**
   * Create a new dwelling for a user
   */
  static async createDwelling(
    userId: string,
    timeZone: string,
    location: Location
  ): Promise<Dwelling> {
    // Validate input
    const dwellingData = {
      dwellingId: uuidv4(),
      userId,
      timeZone,
      location
    };

    const validatedDwelling = DwellingSchema.parse(dwellingData);

    // Insert dwelling into database
    const result = await query(
      `INSERT INTO dwellings (dwelling_id, user_id, time_zone, location) 
       VALUES ($1, $2, $3, $4) 
       RETURNING dwelling_id, user_id, time_zone, location, created_at, updated_at`,
      [
        validatedDwelling.dwellingId,
        validatedDwelling.userId,
        validatedDwelling.timeZone,
        JSON.stringify(validatedDwelling.location)
      ]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create dwelling');
    }

    const row = result.rows[0];
    return {
      dwellingId: row.dwelling_id,
      userId: row.user_id,
      timeZone: row.time_zone,
      location: row.location
    };
  }

  /**
   * Get dwelling by ID and verify ownership
   */
  static async getDwelling(dwellingId: string, userId: string): Promise<Dwelling | null> {
    const result = await query(
      `SELECT dwelling_id, user_id, time_zone, location, created_at, updated_at 
       FROM dwellings 
       WHERE dwelling_id = $1 AND user_id = $2`,
      [dwellingId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      dwellingId: row.dwelling_id,
      userId: row.user_id,
      timeZone: row.time_zone,
      location: row.location
    };
  }

  /**
   * Get all dwellings for a user
   */
  static async getUserDwellings(userId: string): Promise<Dwelling[]> {
    const result = await query(
      `SELECT dwelling_id, user_id, time_zone, location, created_at, updated_at 
       FROM dwellings 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(row => ({
      dwellingId: row.dwelling_id,
      userId: row.user_id,
      timeZone: row.time_zone,
      location: row.location
    }));
  }

  /**
   * Update dwelling location or timezone
   */
  static async updateDwelling(
    dwellingId: string,
    userId: string,
    updates: Partial<Pick<Dwelling, 'timeZone' | 'location'>>
  ): Promise<Dwelling | null> {
    const setParts: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.timeZone !== undefined) {
      setParts.push(`time_zone = $${paramIndex}`);
      values.push(updates.timeZone);
      paramIndex++;
    }

    if (updates.location !== undefined) {
      setParts.push(`location = $${paramIndex}`);
      values.push(JSON.stringify(updates.location));
      paramIndex++;
    }

    if (setParts.length === 0) {
      // No updates provided, return current dwelling
      return this.getDwelling(dwellingId, userId);
    }

    // Add WHERE clause parameters
    values.push(dwellingId, userId);

    const result = await query(
      `UPDATE dwellings 
       SET ${setParts.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE dwelling_id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING dwelling_id, user_id, time_zone, location`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      dwellingId: row.dwelling_id,
      userId: row.user_id,
      timeZone: row.time_zone,
      location: row.location
    };
  }

  /**
   * Delete a dwelling and all its devices
   */
  static async deleteDwelling(dwellingId: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM dwellings WHERE dwelling_id = $1 AND user_id = $2',
      [dwellingId, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Check if dwelling exists and user has access
   */
  static async validateDwellingAccess(dwellingId: string, userId: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM dwellings WHERE dwelling_id = $1 AND user_id = $2',
      [dwellingId, userId]
    );

    return result.rows.length > 0;
  }
} 