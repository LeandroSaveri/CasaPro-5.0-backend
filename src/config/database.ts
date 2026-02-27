import { Pool } from "pg";
import { env } from "./env";

let pool: Pool | null = null;

export async function connectDatabase(): Promise<void> {
  if (!env.DATABASE_URL) {
    console.warn("⚠️ DATABASE_URL not configured. Skipping database connection.");
    return;
  }

  try {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl:
        env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });

    await pool.query("SELECT 1");

    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
    throw error;
  }
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error("Database not initialized. Call connectDatabase() first.");
  }
  return pool;
}
