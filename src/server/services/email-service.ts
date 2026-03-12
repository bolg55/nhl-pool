import "@tanstack/react-start/server-only";
import { Resend } from "resend";

import { OtpCodeEmail } from "@/emails/otp-code";
import { env } from "@/env/server";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendOtpEmail(email: string, otp: string, type: string) {
  const subject =
    type === "forget-password"
      ? "Your NHL Pool password reset code"
      : type === "email-verification"
        ? "Verify your NHL Pool email"
        : "Your NHL Pool sign-in code";

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject,
    react: OtpCodeEmail({ otp }),
  });

  if (error) {
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
}
