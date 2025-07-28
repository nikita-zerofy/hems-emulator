import { Database } from 'sqlite3';
import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.SQLITE_DB_PATH || '/app/data/hems.db';
const GCS_BUCKET = process.env.GCS_BUCKET || null;
const GCS_DB_FILE = process.env.GCS_DB_FILE || 'hems.db';

class SQLiteManager {
  private db: Database | null = null;
  private storage: Storage | null = null;

  constructor() {
    if (GCS_BUCKET) {
      this.storage = new Storage();
    }
  }

  /**
   * Initialize SQLite database with Cloud Storage backup
   */
  async initialize(): Promise<Database> {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Download existing database from Cloud Storage if available
    if (this.storage && GCS_BUCKET) {
      try {
        await this.downloadFromGCS();
        console.log('📦 Downloaded existing database from Cloud Storage');
      } catch (error) {
        console.log('📦 No existing database in Cloud Storage, creating new one');
      }
    }

    // Create/open SQLite database
    this.db = new Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ SQLite connection error:', err);
        throw err;
      }
      console.log('✅ Connected to SQLite database at:', DB_PATH);
    });

    // Initialize schema if needed
    await this.initializeSchema();

    // Set up periodic backup to Cloud Storage
    if (this.storage && GCS_BUCKET) {
      this.setupPeriodicBackup();
    }

    return this.db;
  }

  /**
   * Download database file from Cloud Storage
   */
  private async downloadFromGCS(): Promise<void> {
    if (!this.storage || !GCS_BUCKET) return;

    const bucket = this.storage.bucket(GCS_BUCKET);
    const file = bucket.file(GCS_DB_FILE);

    const [exists] = await file.exists();
    if (exists) {
      await file.download({ destination: DB_PATH });
    }
  }

  /**
   * Upload database file to Cloud Storage
   */
  private async uploadToGCS(): Promise<void> {
    if (!this.storage || !GCS_BUCKET) return;

    try {
      const bucket = this.storage.bucket(GCS_BUCKET);
      await bucket.upload(DB_PATH, {
        destination: GCS_DB_FILE,
        metadata: {
          metadata: {
            lastBackup: new Date().toISOString(),
            source: 'hems-emulator'
          }
        }
      });
      console.log('📦 Database backed up to Cloud Storage');
    } catch (error) {
      console.error('❌ Failed to backup to Cloud Storage:', error);
    }
  }

  /**
   * Set up periodic backup every 5 minutes
   */
  private setupPeriodicBackup(): void {
    setInterval(async () => {
      await this.uploadToGCS();
    }, 5 * 60 * 1000); // 5 minutes

    // Also backup on process exit
    process.on('SIGTERM', async () => {
      console.log('📦 Backing up database before shutdown...');
      await this.uploadToGCS();
      process.exit(0);
    });
  }

  /**
   * Initialize database schema
   */
  private async initializeSchema(): Promise<void> {
    if (!this.db) return;

    const schemaPath = path.join(__dirname, '../../database/init.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      return new Promise((resolve, reject) => {
        this.db!.exec(schema, (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('✅ Database schema initialized');
            resolve();
          }
        });
      });
    }
  }

  /**
   * Get database instance
   */
  getDatabase(): Database | null {
    return this.db;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve) => {
        this.db!.close((err) => {
          if (err) {
            console.error('❌ Error closing database:', err);
          } else {
            console.log('✅ Database connection closed');
          }
          resolve();
        });
      });
    }
  }
}

// Export singleton instance
export const sqliteManager = new SQLiteManager(); 