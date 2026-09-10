// Central, typed access to environment variables. Fails fast and loudly if a
// required variable is missing, rather than letting `undefined` leak into a
// Supabase client constructor and fail cryptically later.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: () =>
    required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: () =>
    required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  supabaseSecretKey: () =>
    required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
};
