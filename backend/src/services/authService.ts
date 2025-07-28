import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {v4 as uuidv4} from 'uuid';
import {query} from '../config/database';
import {UserWithoutPassword, JwtPayload, UserSchema} from '../types';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your_jwt_secret_key_change_in_production';
// const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN ?? '7d';
const SALT_ROUNDS = 12;

export class AuthService {
  /**
   * Register a new user with email and password
   */
  static async register(email: string, password: string): Promise<{ user: UserWithoutPassword; token: string }> {
    // Validate input
    const validatedUser = UserSchema.omit({userId: true}).parse({email, password});

    // Check if user already exists
    const existingUser = await query('SELECT user_id FROM users WHERE email = $1', [validatedUser.email]);
    if (existingUser.rows.length > 0) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedUser.password, SALT_ROUNDS);

    // Create user
    const userId = uuidv4();
    const result = await query(
      'INSERT INTO users (user_id, email, password) VALUES ($1, $2, $3) RETURNING user_id, email, created_at',
      [userId, validatedUser.email, hashedPassword]
    );

    if (result.rows.length === 0) {
      throw new Error('Failed to create user');
    }

    const user: UserWithoutPassword = {
      userId: result.rows[0].user_id,
      email: result.rows[0].email
    };

    // Generate JWT token
    const token = this.generateToken(user);

    return {user, token};
  }

  /**
   * Login user with email and password
   */
  static async login(email: string, password: string): Promise<{ user: UserWithoutPassword; token: string }> {
    // Get user from database
    const result = await query('SELECT user_id, email, password FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const dbUser = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, dbUser.password);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    const user: UserWithoutPassword = {
      userId: dbUser.user_id,
      email: dbUser.email
    };

    // Generate JWT token
    const token = this.generateToken(user);

    return {user, token};
  }

  /**
   * Generate JWT token for user
   */
  static generateToken(user: UserWithoutPassword): string {
    const payload: JwtPayload = {
      userId: user.userId,
      email: user.email
    };

    // @ts-ignore
    // Create non-expiring token for development/testing
    return jwt.sign(payload, JWT_SECRET);
  }

  /**
   * Verify JWT token and return user payload
   */
  static verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID (without password)
   */
  static async getUserById(userId: string): Promise<UserWithoutPassword | null> {
    const result = await query('SELECT user_id, email FROM users WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    return {
      userId: result.rows[0].user_id,
      email: result.rows[0].email
    };
  }

  /**
   * Update user password
   */
  static async updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Get current password hash
    const result = await query('SELECT password FROM users WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await query('UPDATE users SET password = $1 WHERE user_id = $2', [hashedNewPassword, userId]);
  }
} 