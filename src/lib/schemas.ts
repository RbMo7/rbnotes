import { z } from "zod";

// --- Auth ---------------------------------------------------------------

export const emailSchema = z
  .email("Enter a valid email address")
  .max(255);

export const passwordSchema = z
  .string()
  .min(8, "Passkey must be at least 8 characters")
  .max(128);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Passkey is required"),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passkeys do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passkeys do not match",
    path: ["confirmPassword"],
  });

// --- Notes ----------------------------------------------------------------
// Deliberately no `userId` field anywhere below — it is always derived
// server-side from the session, never accepted from the client.

export const updateNoteContentSchema = z.object({
  noteId: z.uuid(),
  content: z.string().max(1_000_000),
});

export const noteIdSchema = z.object({
  noteId: z.uuid(),
});

export const setNoteFlagSchema = z.object({
  noteId: z.uuid(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const searchNotesSchema = z.object({
  query: z.string().min(1).max(200),
});

export const pingDeviceSchema = z.object({
  deviceId: z.uuid(),
});

// --- Settings ---------------------------------------------------------------

export const settingsSchema = z.object({
  lineNumbers: z.enum(["off", "absolute", "relative", "hybrid"]).default("hybrid"),
  tabSize: z.number().int().min(1).max(8).default(2),
  wordWrap: z.boolean().default(true),
  autosave: z.boolean().default(true),
  sidebarCollapsed: z.boolean().default(false),
});

export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = settingsSchema.parse({});
