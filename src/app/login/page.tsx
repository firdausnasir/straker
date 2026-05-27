import { redirect } from "next/navigation";
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

      <div className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
          Commitment Tracker
        </p>
        <h1 className="mt-3 text-5xl font-bold leading-[0.98] tracking-tight text-foreground">
          The quiet
          <br />
          ledger.
        </h1>
        <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
          Every subscription, recurring bill, and loan — sorted by what falls due
          next. In ringgit or dollars, exactly as charged.
        </p>
      </div>

      <AuthForm />
    </main>
  );
}
