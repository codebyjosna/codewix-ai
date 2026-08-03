import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .email("Enter a valid email address");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be at most 100 characters")
  .regex(/^[\p{L} .'-]+$/u, "Name contains invalid characters");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const otpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "Enter the 6-digit code");

export const otpPurposeSchema = z.enum(["signup", "reset"]);

export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  purpose: otpPurposeSchema,
});

export const resendOtpSchema = z.object({
  email: emailSchema,
  purpose: otpPurposeSchema,
});

export const resetPasswordRequestSchema = z.object({
  email: emailSchema,
});

export const resetPasswordConfirmSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required"),
  password: passwordSchema,
});

export const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Project name is required")
  .max(100, "Project name must be at most 100 characters")
  .regex(
    /^[a-zA-Z0-9 ]+$/,
    "Project name can only contain letters, numbers, and spaces",
  );

export const projectDescriptionSchema = z
  .string()
  .trim()
  .min(10, "Description must be at least 10 characters")
  .max(1000, "Description must be at most 1000 characters");

export const buildPromptSchema = z
  .string()
  .trim()
  .min(1, "Build prompt is required")
  .max(8000, "Build prompt is too long");

export const createProjectSchema = z.object({
  name: projectNameSchema,
  description: projectDescriptionSchema,
  buildPrompt: buildPromptSchema,
  projectTypeId: z.string().uuid("Invalid project type"),
  visibilityId: z.string().uuid("Invalid visibility option"),
  screenshotUrl: z.string().trim().url("Invalid screenshot URL").max(2048).optional(),
});

// Returns the first validation issue's message, suitable for a single
// user-facing error string.
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
