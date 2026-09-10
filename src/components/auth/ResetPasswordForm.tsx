"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  TerminalWindow,
  TerminalHeader,
  TerminalFooter,
} from "@/components/auth/TerminalWindow";
import { AuthField } from "@/components/auth/AuthField";
import { ExecuteButton } from "@/components/auth/AuthButtons";
import { StatusToast } from "@/components/auth/StatusToast";
import { updatePasswordAction } from "@/server/actions/auth";
import { resetPasswordSchema } from "@/lib/schemas";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
        return;
      }
      setError(null);
      setStatus("RESET: writing new secret...");
      startTransition(async () => {
        const result = await updatePasswordAction({ password, confirmPassword });
        if (!result.ok) {
          setError(result.message);
          setStatus(`RESET: ${result.message}`);
          return;
        }
        setStatus("RESET: secret updated — redirecting...");
        router.push("/notes");
        router.refresh();
      });
    },
    [password, confirmPassword, router],
  );

  return (
    <main className="w-full max-w-md">
      <div className="flex flex-col w-full">
        <TerminalWindow
          titleBarLabel="RESET.BUFFER.V1"
          footer={
            <TerminalFooter
              hints={[
                ["[Tab]", "Next"],
                ["[Enter]", "Submit"],
              ]}
            />
          }
        >
          <TerminalHeader tag="STABLE" tagline="Write. Think. Save." />
          <form className="flex flex-col gap-space-4" onSubmit={handleSubmit}>
            <AuthField
              id="password"
              label="new secret (passkey)"
              shortcut="[Tab]"
              prefix="*"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="tracking-widest"
            />
            <AuthField
              id="confirmPassword"
              label="confirm (passkey)"
              shortcut="[Enter]"
              prefix="*"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="tracking-widest"
              error={error ?? undefined}
            />
            <div className="pt-space-2">
              <ExecuteButton
                label="Commit New Secret"
                chip="[:w]"
                pending={pending}
                pendingLabel="Writing…"
              />
            </div>
          </form>
        </TerminalWindow>
        <StatusToast message={status} tone={error ? "error" : "info"} />
      </div>
    </main>
  );
}
