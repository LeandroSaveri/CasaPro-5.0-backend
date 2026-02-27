import dotenv from "dotenv";

dotenv.config();

function getOptional(name: string, defaultValue?: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return defaultValue;
  }
  return value;
}

function getNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;

  const parsed = Number(value);
  if (isNaN(parsed)) {
    console.warn(`⚠️ Environment variable ${name} is not a valid number. Using default ${defaultValue}`);
    return defaultValue;
  }

  return parsed;
}

export const env = {
  NODE_ENV: getOptional("NODE_ENV", "development") as string,

  PORT: getNumber("PORT", 3000),

  DATABASE_URL: getOptional("DATABASE_URL"),

  JWT_SECRET: getOptional("JWT_SECRET", "dev-secret-change-this") as string,
};
