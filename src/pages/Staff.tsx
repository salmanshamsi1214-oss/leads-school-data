import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, ShieldCheck, UserCog } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Role } from "@/convex/schema";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS, ROLE_OPTIONS } from "@/lib/roles";
import { useAuth } from "@/hooks/use-auth";

type AccountRow = {
  _id: Id<"users">;
  name: string;
  email: string;
  role: string;
  isAnonymous: boolean;
};

function RoleSelect({
  account,
  currentUserId,
}: {
  account: AccountRow;
  currentUserId: string | undefined;
}) {
  const [pending, setPending] = useState(false);
  const setRole = useMutation(api.users.setRole);
  const isSelf = account._id === currentUserId;

  const handleChange = async (value: string) => {
    setPending(true);
    try {
      await setRole({ userId: account._id, role: value as Role });
      toast(`${account.email || "Account"} is now ${ROLE_LABELS[value as keyof typeof ROLE_LABELS] ?? value}.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not change the role.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select
        value={account.role}
        onValueChange={handleChange}
        disabled={pending || isSelf}
      >
        <SelectTrigger className="h-8 w-48" aria-label={`Role for ${account.email}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      {isSelf && (
        <span className="text-xs text-muted-foreground" title="Admins cannot change their own role">
          you
        </span>
      )}
    </div>
  );
}

export default function Staff() {
  const accounts = useQuery(api.users.listAccounts);
  const { user } = useAuth();
  const myId = (user as Doc<"users"> | null | undefined)?._id;

  if (accounts === undefined) {
    return (
      <AppShell title="Staff & Roles">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const staffCount = accounts.filter(
    (account) => account.role !== "user" && account.role !== "parent" && account.role !== "student",
  ).length;

  return (
    <AppShell title="Staff & Roles">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4 rounded-xl border bg-card p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-5" />
          </div>
          <div className="text-sm leading-6 text-muted-foreground">
            <p className="font-semibold text-foreground">Account roles</p>
            <p className="mt-0.5">
              Every signed-in account starts as <Badge variant="outline" className="mx-1 font-normal">Pending approval</Badge>{" "}
              until you assign a role here. Roles decide which modules each person can open —
              e.g. <span className="font-medium text-foreground">Teacher</span> can mark attendance,{" "}
              <span className="font-medium text-foreground">Accountant</span> runs fees, and{" "}
              <span className="font-medium text-foreground">Receptionist</span> manages students.
              {staffCount > 0 && (
                <span className="mt-1 block">Currently {staffCount} staff account{staffCount === 1 ? "" : "s"} with access.</span>
              )}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account._id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserCog className="size-4 text-muted-foreground" />
                      <span className="font-medium">{account.name || "—"}</span>
                      {account.isAnonymous && (
                        <Badge variant="outline" className="font-normal">
                          Guest
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{account.email || "—"}</TableCell>
                  <TableCell>
                    <RoleSelect account={account} currentUserId={myId} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
