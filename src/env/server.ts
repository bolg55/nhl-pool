import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    VITE_BASE_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM_EMAIL: z.string().default("NHL Pool <onboarding@resend.dev>"),
    NHL_SALARY_API_URL: z.url(),
    NHL_SALARY_API_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
});
