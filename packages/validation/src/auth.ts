import { z } from "zod";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(25, "Username must be 25 characters or fewer.")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores.");

const emailSchema = z.email().transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password is too long.");

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Email or username is required."),
  password: passwordSchema
});

export const googleAuthSchema = z.object({
  credential: z.string().min(1, "Google credential is required.")
});

export const safeUserSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  createdAt: z.string()
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type SafeUser = z.infer<typeof safeUserSchema>;
