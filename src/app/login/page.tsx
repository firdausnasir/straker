import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { auth } from "@/auth";
import { AuthForm } from "./auth-form";
import { ThemeButton } from "@/components/theme-button";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <div className="absolute right-5 top-5">
        <ThemeButton />
      </div>

      <div>
        {/* Brand moment — the one place the restrained cobalt→cyan accent lands. */}
        <div
          className="animate-reveal flex items-center gap-3"
          style={{ animationDelay: "0ms" }}
        >
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl text-primary-foreground shadow-sm"
            style={{ backgroundImage: "var(--gradient-accent)" }}
          >
            <Wallet className="h-[22px] w-[22px]" strokeWidth={2.25} />
          </span>
          <span className="font-display text-lg tracking-tight text-foreground">
            Straker
          </span>
        </div>

        <h1
          className="font-display animate-reveal mt-7 text-4xl leading-[1.05] text-balance text-foreground"
          style={{ animationDelay: "60ms" }}
        >
          Every commitment,
          <br />
          one clear balance.
        </h1>
        <p
          className="animate-reveal mt-4 max-w-sm text-[15px] leading-relaxed text-pretty text-muted-foreground"
          style={{ animationDelay: "120ms" }}
        >
          Subscriptions, recurring bills, and loans — sorted by what falls due
          next, in ringgit or dollars, exactly as charged.
        </p>
      </div>

      <AuthForm />
    </main>
  );
}
