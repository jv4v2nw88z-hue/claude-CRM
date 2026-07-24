import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Optional integrations. Each one degrades gracefully when unset so the app
  // still boots on a laptop with nothing but Postgres running.
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("MiDigitalExpansion CRM <crm@midigitalexpansion.com>"),

  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().optional(), // set for Cloudflare R2
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),

  // Lets an external cron service (cron-job.org etc.) poke the automation engine
  // if the host spins the process down between requests.
  AUTOMATION_CRON: z.string().default("0 6 * * *"),
  AUTOMATION_SECRET: z.string().optional(),
  DISABLE_CRON: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isEmailEnabled = Boolean(env.RESEND_API_KEY);
export const isStorageEnabled = Boolean(
  env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY
);
