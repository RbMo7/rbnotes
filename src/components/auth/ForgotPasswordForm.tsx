"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { TerminalWindow, TerminalHeader } from "@/components/auth/TerminalWindow";
import { AuthField } from "@/components/auth/AuthField";
import { ExecuteButton } from "@/components/auth/AuthButtons";
import { StatusToast } from "@/components/auth/StatusToast";
import { requestPasswordResetAction } from "@/server/actions/auth";
import { forgotPasswordSchema } from "@/lib/schemas";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const parsed = forgotPasswordSchema.safeParse({ email });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
        return;
      }
      setError(null);
      setStatus(`RESET: dispatching link to ${email}...`);
      startTransition(async () => {
        const result = await requestPasswordResetAction({ email });
        if (!result.ok) {
          setError(result.message);
          setStatus(`RESET: ${result.message}`);
          return;
        }
        setSent(true);
        setStatus("RESET: link dispatched — check your inbox");
      });
    },
    [email],
  );

  return (
    <main className="w-full max-w-md">
      <div className="flex flex-col w-full">
        <TerminalWindow titleBarLabel="RESET.BUFFER">
          <TerminalHeader tagline="Write. Think. Save." />
          {sent ? (
            <p className="font-body-md text-body-md text-on-surface-variant">
              <span className="text-primary">&gt;&gt;</span> Reset link dispatched to{" "}
              <span className="text-on-surface">{email}</span>. Follow it to continue.
            </p>
          ) : (
            <form className="flex flex-col gap-space-4" onSubmit={handleSubmit}>
              <AuthField
                id="email"
                label="identity (email)"
                prefix="@"
                type="email"
                autoComplete="email"
                placeholder="developer@domain.io"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error ?? undefined}
              />
              <div className="pt-space-2">
                <ExecuteButton
                  label="Dispatch Reset Link"
                  chip="[:w]"
                  pending={pending}
                  pendingLabel="Dispatching…"
                />
              </div>
            </form>
          )}
          <div className="flex items-center justify-center font-label-sm text-label-sm text-on-surface-variant">
            <Link className="hover:text-primary transition-colors" href="/login">
              &larr; back to login [:wq]
            </Link>
          </div>
        </TerminalWindow>
        <StatusToast message={status} tone={error ? "error" : "info"} />
      </div>
    </main>
  );
}
