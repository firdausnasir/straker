"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import { KeyRound, Plus, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isPasskeySupported,
  isPasskeyCancellation,
  getPasskey,
  registerPasskey,
  renamePasskey,
  deletePasskey,
  PasskeyError,
  type PasskeySummary,
} from "@/lib/passkey-client";

// Sensitive actions (add/renew/delete) re-prove the password; rename does not.
type ReauthMode = "add" | "renew" | "delete";

const REAUTH_COPY: Record<ReauthMode, { title: string; description: string; confirm: string }> = {
  add: {
    title: "Add a passkey",
    description: "Confirm your password, then follow your device's prompt to create the passkey.",
    confirm: "Continue",
  },
  renew: {
    title: "Renew passkey",
    description: "Replace your current passkey with a new one. Confirm your password to continue.",
    confirm: "Continue",
  },
  delete: {
    title: "Remove passkey",
    description: "You can still sign in with your password. Confirm your password to remove the passkey.",
    confirm: "Remove",
  },
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

export function PasskeySettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [passkey, setPasskey] = useState<PasskeySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Re-auth dialog (add / renew / delete) — password only; naming happens after.
  const [reauth, setReauth] = useState<ReauthMode | null>(null);
  const [password, setPassword] = useState("");

  // Rename dialog (no password). `renameIsGuess` distinguishes the post-add
  // "confirm the guessed name" case from a plain rename, for accurate copy.
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameIsGuess, setRenameIsGuess] = useState(false);

  useEffect(() => {
    let active = true;

    // The summary loads regardless of WebAuthn support so an unsupported
    // browser can still view/remove an existing passkey. Support + loading are
    // set in the async callbacks (not synchronously in the effect body).
    getPasskey()
      .then((p) => {
        if (active) setPasskey(p);
      })
      .catch((error) => {
        if (active && error instanceof PasskeyError && error.status === 401) {
          void signOut({ redirectTo: "/login" });
        }
      })
      .finally(() => {
        if (active) {
          setSupported(isPasskeySupported());
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function openReauth(mode: ReauthMode) {
    setReauth(mode);
    setPassword("");
  }

  function handleAuthError(error: unknown) {
    if (error instanceof PasskeyError && error.status === 401) {
      void signOut({ redirectTo: "/login" });

      return;
    }

    toast.error(error instanceof Error ? error.message : "Something went wrong. Try again.");
  }

  async function confirmReauth() {
    if (!reauth || busy) {
      return;
    }
    setBusy(true);

    try {
      if (reauth === "delete") {
        await deletePasskey(password);
        setPasskey(null);
        toast.success("Passkey removed");
        setReauth(null);
      } else {
        // Add and renew share one flow: confirm password → ceremony → save under
        // a guessed name, then open the naming modal to confirm/edit the guess.
        const wasRenew = reauth === "renew";
        const { guessedName } = await registerPasskey(password);
        setPasskey(await getPasskey());
        setReauth(null);
        toast.success(wasRenew ? "Passkey renewed" : "Passkey added");
        setRenameValue(guessedName);
        setRenameIsGuess(true);
        setRenaming(true);
      }
    } catch (error) {
      // User dismissed the native prompt — keep the dialog open, no error noise.
      if (isPasskeyCancellation(error)) {
        return;
      }

      handleAuthError(error);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRename() {
    const next = renameValue.trim();

    if (!next || busy) {
      return;
    }
    setBusy(true);

    try {
      await renamePasskey(next);
      setPasskey((current) => (current ? { ...current, deviceName: next } : current));
      toast.success("Passkey renamed");
      setRenaming(false);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setBusy(false);
    }
  }

  const reauthCopy = reauth ? REAUTH_COPY[reauth] : null;
  const isDelete = reauth === "delete";

  return (
    <section className="space-y-2.5">
      <h2 className="px-1 text-[13px] font-medium text-muted-foreground">Passkey</h2>
      <div className="surface px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--clay-tint)] text-primary">
            <KeyRound className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold text-foreground">
              {passkey ? passkey.deviceName : "Passkey"}
            </span>
            <span className="block text-[13px] text-muted-foreground">
              {loading
                ? "Checking…"
                : passkey
                  ? `Added ${formatDate(passkey.createdAt)} · Last used ${
                      passkey.lastUsedAt ? formatDate(passkey.lastUsedAt) : "never"
                    }`
                  : supported === false
                    ? "This browser doesn't support passkeys"
                    : "Sign in with Face ID, Touch ID, or a security key"}
            </span>
          </span>
        </div>

        {!loading && !passkey && (
          <Button
            onClick={() => openReauth("add")}
            disabled={supported !== true}
            className="mt-5 h-11 w-full justify-center gap-2 rounded-full text-[14px] font-semibold"
            style={{ boxShadow: "var(--shadow-cta)" }}
          >
            <Plus className="h-4 w-4" />
            Add a passkey
          </Button>
        )}

        {!loading && passkey && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setRenameValue(passkey.deviceName);
                setRenameIsGuess(false);
                setRenaming(true);
              }}
              className="h-11 justify-center gap-1.5 rounded-full text-[13px]"
            >
              <Pencil className="h-4 w-4" />
              Rename
            </Button>
            <Button
              variant="secondary"
              onClick={() => openReauth("renew")}
              disabled={supported !== true}
              className="h-11 justify-center gap-1.5 rounded-full text-[13px]"
            >
              <RefreshCw className="h-4 w-4" />
              Renew
            </Button>
            <Button
              variant="secondary"
              onClick={() => openReauth("delete")}
              className="h-11 justify-center gap-1.5 rounded-full text-[13px] text-[var(--danger)] hover:bg-[var(--danger-tint)] hover:text-[var(--danger)]"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Re-auth dialog: add / renew / delete */}
      <Dialog open={reauth !== null} onOpenChange={(open) => !open && !busy && setReauth(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reauthCopy?.title}</DialogTitle>
            <DialogDescription>{reauthCopy?.description}</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmReauth();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pk-password">Password</Label>
              <Input
                id="pk-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              disabled={busy || password.length === 0}
              className="h-11 w-full justify-center rounded-full text-[14px] font-semibold"
              variant={isDelete ? "destructive" : "default"}
            >
              {busy ? "One moment…" : reauthCopy?.confirm}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename dialog (no password) */}
      <Dialog open={renaming} onOpenChange={(open) => !open && !busy && setRenaming(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{renameIsGuess ? "Name your passkey" : "Rename passkey"}</DialogTitle>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void confirmRename();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pk-rename">Name</Label>
              <Input
                id="pk-rename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={60}
                required
                placeholder="e.g. iPhone, MacBook"
              />
            </div>

            <Button
              type="submit"
              disabled={busy || renameValue.trim().length === 0}
              className="h-11 w-full justify-center rounded-full text-[14px] font-semibold"
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
