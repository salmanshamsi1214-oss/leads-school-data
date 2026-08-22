import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { ROLES, type Role } from "@/convex/schema";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { BRAND } from "@/lib/brand";
import { ROLE_LABELS } from "@/lib/roles";
import logo from "@/assets/leads-logo.svg";

function NoAccess({
  email,
  role,
  canRecover,
  recovering,
  onRecover,
  onSignOut,
}: {
  email?: string;
  role?: string;
  canRecover: boolean;
  recovering: boolean;
  onRecover: () => void;
  onSignOut: () => void;
}) {
  const pending = role === undefined || role === "user";
  const roleLabel = role && !pending ? (ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role) : null;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <img
          src={logo}
          alt={`${BRAND.schoolName} logo`}
          width={72}
          height={72}
          className="mx-auto mb-5 rounded-2xl"
        />
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Access restricted</h1>
        {email && (
          <p className="mt-1 text-xs text-muted-foreground">Signed in as {email}</p>
        )}
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {pending ? (
            <>
              This account is registered with {BRAND.schoolName} but hasn&apos;t
              been assigned a role yet. Ask the school administrator to approve
              it on the Staff &amp; Roles page — until then, no module can be
              opened.
            </>
          ) : (
            <>
              This account has the <span className="font-semibold text-foreground">{roleLabel}</span>{" "}
              role, which can&apos;t open this module. Ask the school administrator
              to change your role on the Staff &amp; Roles page.
            </>
          )}
        </p>
        <div className="mt-6 flex flex-col items-center gap-2">
          {canRecover && (
            <Button
              variant="default"
              className="cursor-pointer"
              onClick={onRecover}
              disabled={recovering}
            >
              {recovering ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              {recovering ? "Claiming admin…" : "Recover admin access"}
            </Button>
          )}
          <Button variant="outline" className="cursor-pointer" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Route gate for the authenticated school experience, restricted to the
 * given roles. Guest (anonymous) accounts are auto-granted admin by
 * bootstrapRole — "Continue as Guest" always has full access, and older
 * guest accounts stuck on a lesser role are re-bootstrapped instead of
 * locked out. Email accounts: the first one created becomes the admin;
 * later accounts keep the plain "user" role until an admin promotes them.
 * The same checks are enforced on every Convex query and mutation, so this
 * UI gate is only the visible layer.
 */
export function RoleGate({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: React.ReactNode;
}) {
  const { user, isLoading, signOut } = useAuth();
  const bootstrapRole = useMutation(api.users.bootstrapRole);
  const recoverAdmin = useMutation(api.users.recoverAdmin);
  const [attempted, setAttempted] = useState(false);
  const [recovering, setRecovering] = useState(false);
  // Ref guard so the bootstrap mutation fires at most once per session — a
  // ref, not state, so flipping it doesn't trigger a cascading render.
  const bootstrapFired = useRef(false);

  useEffect(() => {
    if (isLoading || user == null) return;
    const needsBootstrap =
      user.role === undefined ||
      (user.isAnonymous === true && user.role !== ROLES.ADMIN);
    if (needsBootstrap && !bootstrapFired.current) {
      bootstrapFired.current = true;
      bootstrapRole()
        .catch((error) => {
          console.error("Role bootstrap failed:", error);
        })
        .finally(() => setAttempted(true));
    }
  }, [isLoading, user, bootstrapRole]);

  if (isLoading || user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user === null) return null; // RequireAuth already redirects signed-out users

  const needsBootstrap =
    user.role === undefined ||
    (user.isAnonymous === true && user.role !== ROLES.ADMIN);

  if (needsBootstrap && !attempted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (needsBootstrap || (user.role && !roles.includes(user.role))) {
    return (
      <NoAccess
        email={user.email}
        role={user.role}
        canRecover={Boolean(user.email)}
        recovering={recovering}
        onRecover={async () => {
          setRecovering(true);
          try {
            await recoverAdmin();
            toast("You are now the school admin.", {
              description: "Open Staff & Roles to assign roles to the other accounts.",
            });
            // user.role updates reactively through currentUser, which flips
            // this gate back to the app automatically.
          } catch (error) {
            toast(error instanceof Error ? error.message : "Could not recover admin access.");
          } finally {
            setRecovering(false);
          }
        }}
        onSignOut={async () => await signOut()}
      />
    );
  }

  return <>{children}</>;
}
