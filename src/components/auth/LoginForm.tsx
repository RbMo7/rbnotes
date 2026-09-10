"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TerminalWindow, TerminalHeader, OrDivider } from "@/components/auth/TerminalWindow";
import { AuthField } from "@/components/auth/AuthField";
import { ExecuteButton } from "@/components/auth/AuthButtons";
import { GithubOAuthButton } from "@/components/auth/GithubOAuthButton";
import { StatusToast } from "@/components/auth/StatusToast";
import { loginAction } from "@/server/actions/auth";
import { loginSchema } from "@/lib/schemas";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persist, setPersist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid input");
        return;
      }
      setError(null);
      setStatus(`AUTH: authenticating session for ${email}...`);
      startTransition(async () => {
        const result = await loginAction({ email, password });
        if (!result.ok) {
          setError(result.message);
          setStatus(`AUTH: ${result.message}`);
          return;
        }
        setStatus("AUTH: session established");
        router.push(next);
        router.refresh();
      });
    },
    [email, password, next, router],
  );

  const commands = useMemo(
    () => ({ wq: () => formRef.current?.requestSubmit() }),
    [],
  );

  return (
    <main className="w-full max-w-md">
      <div className="flex flex-col w-full">
        <TerminalWindow titleBarLabel="AUTH.BUFFER" commands={commands}>
          <TerminalHeader tagline="Write. Think. Save." />
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
              error={error && error.toLowerCase().includes("email") ? error : undefined}
            />
            <AuthField
              id="password"
              label="secret (passkey)"
              prefix="*"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="tracking-widest"
            />
            <div className="flex items-center justify-between font-label-sm text-label-sm pt-space-1">
              <label className="flex items-center gap-space-2 cursor-pointer select-none text-on-surface-variant hover:text-on-surface">
                <input
                  className="accent-primary w-3.5 h-3.5 bg-surface-container border-outline-variant rounded-none"
                  type="checkbox"
                  checked={persist}
                  onChange={(e) => setPersist(e.target.checked)}
                />
                <span>persist session</span>
              </label>
              <Link
                className="text-on-surface-variant hover:text-primary transition-colors underline decoration-outline-variant"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            <div className="flex flex-col gap-space-2 pt-space-2">
              <ExecuteButton
                label="Execute Authentication"
                chip="[:wq]"
                pending={pending}
                pendingLabel="Authenticating…"
              />
              <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant px-space-1">
                <span>UNREGISTERED USER?</span>
                <Link
                  className="text-primary hover:underline font-bold flex items-center gap-space-1"
                  href="/register"
                >
                  Register [:new]
                </Link>
              </div>
            </div>
          </form>
          <OrDivider label="or continue with" />
          <GithubOAuthButton onError={setStatus} next={next} />
        </TerminalWindow>
        <StatusToast message={status} tone={error ? "error" : "info"} />
      </div>
    </main>
  );
}
