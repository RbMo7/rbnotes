"use server";

import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/schemas";

export type AuthResult =
  | { ok: true; needsConfirmation?: boolean }
  | { ok: false; message: string };

export async function loginAction(input: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, message: mapAuthError(error.message) };
  return { ok: true };
}

export async function registerAction(input: unknown): Promise<AuthResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { ok: false, message: mapAuthError(error.message) };
  // With email confirmations required (the Supabase project default),
  // signUp() succeeds but returns no session until the link is clicked --
  // redirecting to /notes here would just bounce straight back to /login
  // with no explanation. Report it explicitly instead.
  if (!data.session) return { ok: true, needsConfirmation: true };
  return { ok: true };
}

export async function requestPasswordResetAction(input: unknown): Promise<AuthResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset`,
  });
  if (error) return { ok: false, message: mapAuthError(error.message) };
  return { ok: true };
}

export async function updatePasswordAction(input: unknown): Promise<AuthResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: mapAuthError(error.message) };
  return { ok: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

// Translates Supabase's error strings into the terminal voice of the
// design's status toast (">> AUTH: ...") without leaking raw provider text.
function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "invalid credentials";
  if (lower.includes("already registered") || lower.includes("already exists")) {
    return "identity already registered";
  }
  if (lower.includes("email not confirmed")) return "identity not yet confirmed";
  if (lower.includes("rate limit")) return "too many attempts — retry shortly";
  return message;
}
