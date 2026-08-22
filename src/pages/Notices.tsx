import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  Loader2,
  Megaphone,
  Pencil,
  Pin,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { OFFICE_ROLES } from "@/lib/roles";
import { formatDate, todayStr } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "exam", label: "Exam" },
  { value: "event", label: "Event" },
  { value: "fee", label: "Fee" },
  { value: "holiday", label: "Holiday" },
  { value: "emergency", label: "Emergency" },
] as const;

const CATEGORY_STYLES: Record<(typeof CATEGORIES)[number]["value"], string> = {
  general: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  exam: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  event: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  fee: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  holiday: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  emergency: "bg-red-100 text-red-700 hover:bg-red-100",
};

const categoryLabel = (value: string): string =>
  CATEGORIES.find((category) => category.value === value)?.label ?? "General";

type Notice = NonNullable<ReturnType<typeof useQuery<typeof api.notices.list>>>[number];

const EMPTY_FORM = {
  editingId: "" as string,
  title: "",
  body: "",
  category: "general" as (typeof CATEGORIES)[number]["value"],
  pinned: false,
  publishDate: todayStr(),
};

function DeleteNoticeButton({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 cursor-pointer text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
        <span className="hidden sm:inline">Delete</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this notice?</AlertDialogTitle>
            <AlertDialogDescription>
              “{label}” will be taken off the board. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={async (event) => {
                event.preventDefault();
                setDeleting(true);
                try {
                  await onConfirm();
                  toast("Notice removed.");
                  setOpen(false);
                } catch (error) {
                  toast(error instanceof Error ? error.message : "Could not remove the notice.");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BroadcastButton({ notice }: { notice: Notice }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const sendMessage = useMutation(api.messages.send);

  const handleBroadcast = async () => {
    setSending(true);
    try {
      const result = await sendMessage({
        body: `📢 ${notice.title}\n\n${notice.body}`,
        channel: "whatsapp",
        scope: { type: "all" },
      });
      toast(
        `Broadcast started — ${result.recipientCount} parent${
          result.recipientCount === 1 ? "" : "s"
        } will receive it on WhatsApp${
          result.noPhoneCount > 0
            ? ` (${result.noPhoneCount} student${result.noPhoneCount === 1 ? "" : "s"} without a phone number)`
            : ""
        }.`,
      );
      setOpen(false);
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not start the broadcast. Check the Messages page.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Send className="size-4" />
        <span className="hidden sm:inline">Broadcast to parents</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Broadcast this notice to all parents?</AlertDialogTitle>
            <AlertDialogDescription>
              Every active student&apos;s parent will receive the notice on WhatsApp. You can
              track delivery in the Messages module.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={sending}
              onClick={async (event) => {
                event.preventDefault();
                await handleBroadcast();
              }}
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? "Broadcasting…" : "Send broadcast"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Notices() {
  const { user } = useAuth();
  const isOffice =
    user?.role !== undefined && OFFICE_ROLES.includes(user.role);

  const notices = useQuery(api.notices.list);
  const createNotice = useMutation(api.notices.create);
  const updateNotice = useMutation(api.notices.update);
  const removeNotice = useMutation(api.notices.remove);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const editing = form.editingId !== "";

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, publishDate: todayStr() });
  };

  const handleEdit = (notice: Notice) => {
    setForm({
      editingId: notice._id,
      title: notice.title,
      body: notice.body,
      category: notice.category,
      pinned: notice.pinned,
      publishDate: notice.publishDate,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const args = {
        title: form.title,
        body: form.body,
        category: form.category,
        pinned: form.pinned,
        publishDate: form.publishDate,
      };
      if (editing) {
        await updateNotice({ id: form.editingId as Id<"notices">, ...args });
        toast("Notice updated.");
      } else {
        await createNotice(args);
        toast("Notice published to the board.");
      }
      resetForm();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the notice.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = (notices ?? []).filter(
    (notice) => categoryFilter === "all" || notice.category === categoryFilter,
  );

  return (
    <AppShell title="Notices">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Megaphone className="size-4 shrink-0 text-primary" />
          School notice board — circulars, exam schedules, holidays and events. Office posts,
          everyone reads.
        </div>

        {/* Compose / edit */}
        {isOffice && (
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                {editing ? (
                  <>
                    <Pencil className="size-4 text-primary" /> Edit notice
                  </>
                ) : (
                  <>
                    <Plus className="size-4 text-primary" /> New notice
                  </>
                )}
              </h2>
              {editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 cursor-pointer"
                  onClick={resetForm}
                >
                  Cancel
                </Button>
              )}
            </div>
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-1.5 lg:col-span-1">
                  <Label htmlFor="notice-title">Title</Label>
                  <Input
                    id="notice-title"
                    placeholder="e.g. Parent–Teacher Meeting — Saturday"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notice-category">Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        category: value as (typeof CATEGORIES)[number]["value"],
                      }))
                    }
                  >
                    <SelectTrigger id="notice-category">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="notice-date">Publish date</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="notice-date"
                      type="date"
                      value={form.publishDate}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, publishDate: e.target.value }))
                      }
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="notice-body">Notice text</Label>
                <Textarea
                  id="notice-body"
                  rows={4}
                  placeholder="Write the full notice — what, when, where, and who it affects…"
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Switch
                    checked={form.pinned}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, pinned: checked }))
                    }
                  />
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Pin className="size-3.5" /> Keep pinned to the top
                  </span>
                </label>
                <Button
                  className="cursor-pointer"
                  onClick={handleSave}
                  disabled={saving || form.title.trim() === "" || form.body.trim() === ""}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : editing ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {saving ? "Saving…" : editing ? "Update notice" : "Publish notice"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Category filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer px-3 py-1",
              categoryFilter === "all" && "border-primary text-primary",
            )}
            onClick={() => setCategoryFilter("all")}
          >
            All
          </Badge>
          {CATEGORIES.map((category) => (
            <Badge
              key={category.value}
              variant="outline"
              className={cn(
                "cursor-pointer px-3 py-1",
                categoryFilter === category.value && "border-primary text-primary",
              )}
              onClick={() =>
                setCategoryFilter(categoryFilter === category.value ? "all" : category.value)
              }
            >
              {category.label}
            </Badge>
          ))}
        </div>

        {/* Board */}
        {notices === undefined ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Megaphone className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">Nothing on the board yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isOffice
                  ? "Publish the first notice above — it will appear here for all staff."
                  : "The office hasn't posted any notices in this category yet."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((notice) => (
              <li
                key={notice._id}
                className={cn(
                  "rounded-xl border bg-card p-4",
                  notice.pinned && "border-primary/40 ring-1 ring-primary/10",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {notice.pinned && (
                      <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                        <Pin className="size-3" /> Pinned
                      </Badge>
                    )}
                    <Badge className={CATEGORY_STYLES[notice.category]}>
                      {categoryLabel(notice.category)}
                    </Badge>
                    <h3 className="text-sm font-semibold tracking-tight">{notice.title}</h3>
                  </div>
                  {isOffice && (
                    <div className="flex shrink-0 items-center gap-1">
                      <BroadcastButton notice={notice} />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 cursor-pointer"
                        onClick={() => handleEdit(notice)}
                      >
                        <Pencil className="size-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <DeleteNoticeButton
                        label={notice.title}
                        onConfirm={async () => {
                          await removeNotice({ id: notice._id });
                        }}
                      />
                    </div>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {notice.body}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {formatDate(notice.publishDate)} · Posted by {notice.createdByName}
                  {notice.updatedAt > notice.createdAt + 1000 ? " · Edited" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
