"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TerminalWindow, TerminalHeader } from "@/components/auth/TerminalWindow";
import { AuthField } from "@/components/auth/AuthField";
import { ExecuteButton } from "@/components/auth/AuthButtons";
import { StatusToast } from "@/components/auth/StatusToast";
import { registerAction } from "@/server/actions/auth";
import { registerSchema } from "@/lib/schemas";

export function RegisterForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const parsed = registerSchema.safeParse({ email, password, confirmPassword });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
        setStatus(`REGISTER: ${parsed.error.issues[0]?.message ?? "invalid input"}`);
        return;
      }
      setError(null);
      setStatus(`REGISTER: provisioning identity for ${email}...`);
      startTransition(async () => {
        const result = await registerAction({ email, password, confirmPassword });
        if (!result.ok) {
          setError(result.message);
          setStatus(`REGISTER: ${result.message}`);
          return;
        }
        if (result.needsConfirmation) {
          setConfirmationSent(true);
          setStatus(`REGISTER: confirmation link dispatched to ${email}`);
          return;
        }
        setStatus("REGISTER: identity created — signing in...");
        router.push("/");
        router.refresh();
      });
    },
    [email, password, confirmPassword, router],
  );

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        formRef.current?.reset();
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setError(null);
        setStatus("SYS: input buffer flushed");
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, []);

  return (
    <main className="w-full max-w-md">
      <div className="flex flex-col w-full">
        <TerminalWindow titleBarLabel="NEW.USER">
          <TerminalHeader tagline="Write. Think. Save." />
          {confirmationSent ? (
            <div className="flex flex-col gap-space-3">
              <p className="font-body-md text-body-md text-on-surface-variant">
                <span className="text-primary">&gt;&gt;</span> A confirmation link was sent to{" "}
                <span className="text-on-surface">{email}</span>. Follow it, then return here to
                log in.
              </p>
              <Link
                href="/login"
                className="text-primary hover:underline font-label-md text-label-md"
              >
                Login [:wq]
              </Link>
            </div>
          ) : (
          <form ref={formRef} className="flex flex-col gap-space-4" onSubmit={handleSubmit}>
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
            />
            <AuthField
              id="password"
              label="secret (passkey)"
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
              prefix="*"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="tracking-widest"
              error={error && error.toLowerCase().includes("match") ? error : undefined}
            />
            <div className="flex flex-col gap-space-2 pt-space-2">
              <ExecuteButton
                label="Register Identity"
                chip="[:new]"
                pending={pending}
                pendingLabel="Provisioning…"
              />
              <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant px-space-1">
                <span>ALREADY REGISTERED?</span>
                <Link
                  className="text-primary hover:underline font-bold flex items-center gap-space-1"
                  href="/login"
                >
                  Login [:wq]
                </Link>
              </div>
            </div>
          </form>
          )}
        </TerminalWindow>
        <StatusToast message={status} tone={error ? "error" : "info"} />
      </div>
    </main>
  );
}
