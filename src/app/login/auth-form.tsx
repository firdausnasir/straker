"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Mode = "login" | "register";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      // Registration first creates the account, then falls through to sign-in.
      if (mode === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Could not create your account. Try again.");

          return;
        }
      }

      const result = await signIn("credentials", { email, password, redirect: false });

      if (result?.error) {
        setError(mode === "register" ? "Account created, but sign-in failed." : "Invalid email or password");

        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <form
      onSubmit={handleSubmit}
      className="surface-float animate-rise mt-9 p-7"
      style={{ animationDelay: "80ms" }}
    >
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {isLogin ? "Welcome back" : "Create account"}
      </h2>

      <div className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            {!isLogin && <span className="text-xs text-muted-foreground">At least 8 characters</span>}
          </div>
          <Input
            id="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-[var(--danger-tint)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="mt-6 h-12 w-full rounded-full text-[15px] font-semibold"
        style={{ boxShadow: "var(--shadow-cta)" }}
      >
        {pending ? "One moment…" : isLogin ? "Sign in" : "Create account"}
      </Button>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {isLogin ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(isLogin ? "register" : "login");
            setError(null);
          }}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          {isLogin ? "Create one" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
