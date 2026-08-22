import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  RotateCcw,
  School,
  Search,
  Send,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

const MAX_LENGTH = 1600;

type Audience = "all" | "class" | "students";
type Channel = "whatsapp" | "sms";

const STATE_META: Record<string, { label: string; className: string }> = {
  sending: { label: "Sending…", className: "bg-amber-100 text-amber-800 border-amber-200" },
  sent: { label: "Sent", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  partial: { label: "Partly sent", className: "bg-amber-100 text-amber-800 border-amber-200" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 border-red-200" },
};

const RECIPIENT_STATE_META: Record<string, { label: string; className: string }> = {
  sent: { label: "Sent", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800 border-red-200" },
  sending: { label: "Sending…", className: "bg-amber-100 text-amber-800 border-amber-200" },
  no_phone: { label: "No phone", className: "bg-slate-100 text-slate-600 border-slate-300" },
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------------- Message history row ---------------- */

function MessageDetails({ messageId }: { messageId: Id<"messages"> }) {
  const details = useQuery(api.messages.details, { messageId });
  const resendFailed = useMutation(api.messages.resendFailed);
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    try {
      const count = await resendFailed({ messageId });
      toast(`${count} message${count === 1 ? "" : "s"} re-queued for delivery.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not resend.");
    } finally {
      setResending(false);
    }
  };

  if (details === undefined) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (details === null) return null;

  const failed = details.message.failedCount;

  return (
    <div className="border-t bg-secondary/30 px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {details.recipients.length} recipient{details.recipients.length === 1 ? "" : "s"} in
          this send
        </p>
        {failed > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            Resend {failed} failed
          </Button>
        )}
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {details.recipients.map((recipient) => {
          const meta = RECIPIENT_STATE_META[recipient.state] ?? RECIPIENT_STATE_META.failed;
          return (
            <li
              key={recipient._id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
            >
              <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-semibold">{recipient.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {recipient.className} · Section {recipient.section} · Roll {recipient.rollNumber}
                  {recipient.phone ? ` · ${recipient.phone}` : ""}
                </p>
                {recipient.error && recipient.state === "failed" && (
                  <p className="mt-0.5 truncate text-[10px] text-red-500" title={recipient.error}>
                    {recipient.error}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  meta.className,
                )}
              >
                {meta.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type MessageRow = Doc<"messages"> & { createdByName: string };

function MessageRow({ message }: { message: MessageRow }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATE_META[message.state] ?? STATE_META.sending;

  return (
    <li className="overflow-hidden rounded-xl border bg-card">
      <button
        type="button"
        className="flex w-full flex-col gap-2 px-4 py-3 text-left sm:flex-row sm:items-center sm:gap-4"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            message.channel === "whatsapp"
              ? "bg-emerald-100 text-emerald-600"
              : "bg-primary/10 text-primary",
          )}
        >
          {message.channel === "whatsapp" ? (
            <MessageCircle className="size-4" />
          ) : (
            <MessageSquare className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="line-clamp-2 text-sm font-medium">{message.body}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {message.target} · {formatTime(message._creationTime)} · {message.createdByName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {message.sentCount > 0 && (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              {message.sentCount} sent
            </Badge>
          )}
          {message.failedCount > 0 && (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              {message.failedCount} failed
            </Badge>
          )}
          {message.noPhoneCount > 0 && (
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">
              {message.noPhoneCount} no phone
            </Badge>
          )}
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              meta.className,
            )}
          >
            {meta.label}
          </span>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>
      {expanded && <MessageDetails messageId={message._id} />}
    </li>
  );
}

/* ---------------- Page ---------------- */

export default function Messages() {
  const classes = useQuery(api.classes.list) ?? [];
  const allStudents = useQuery(api.students.list, { status: "active" }) ?? [];

  // ---- Compose state ----
  const [audience, setAudience] = useState<Audience>("all");
  const [classId, setClassId] = useState<string>("");
  const [section, setSection] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const sendMessage = useMutation(api.messages.send);

  const selectedClass = classes.find((cls) => cls._id === classId);
  const sectionOptions = selectedClass?.sections ?? [];

  const scope = useMemo(() => {
    if (audience === "all") return { type: "all" } as const;
    if (audience === "class") {
      if (!classId) return null;
      return {
        type: "class" as const,
        classId: classId as never,
        section: section === "all" ? undefined : section,
      };
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return null;
    return { type: "students" as const, studentIds: ids as never[] };
  }, [audience, classId, section, selectedIds]);

  const preview = useQuery(api.messages.recipientsPreview, scope ? { scope } : "skip");

  const filteredStudents = useMemo(() => {
    const search = studentSearch.trim().toLowerCase();
    if (!search) return allStudents;
    return allStudents.filter(
      (student) =>
        student.name.toLowerCase().includes(search) ||
        student.rollNumber.toLowerCase().includes(search) ||
        student.className.toLowerCase().includes(search),
    );
  }, [allStudents, studentSearch]);

  const toggleStudent = (studentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const filteredIds = filteredStudents.map((s) => s._id);
    const allSelected = filteredIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of filteredIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const recipientCount = preview?.withPhone ?? 0;
  const canSend =
    body.trim().length > 0 && body.trim().length <= MAX_LENGTH && recipientCount > 0;

  const handleSend = async () => {
    if (!scope || !canSend) return;
    setSending(true);
    try {
      const result = await sendMessage({
        body: body.trim(),
        channel,
        scope,
      });
      toast.success(
        `${channel === "whatsapp" ? "WhatsApp" : "SMS"} message queued for ${result.recipientCount} parent${result.recipientCount === 1 ? "" : "s"}.`,
        { description: "Delivery runs in the background — status updates below." },
      );
      setBody("");
      setSelectedIds(new Set());
      setConfirmOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  };

  const messages = useQuery(api.messages.list);
  const unconfigured = (messages ?? []).some((message) => message.error === "unconfigured");

  const audienceLabel =
    audience === "all"
      ? "all parents"
      : audience === "class"
        ? `${selectedClass?.name ?? "the selected class"}${section !== "all" ? ` · Section ${section}` : ""}`
        : `${selectedIds.size} selected student${selectedIds.size === 1 ? "" : "s"}`;

  return (
    <AppShell title="Messages">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          <MessageSquareText className="size-4 shrink-0 text-primary" />
          Send a notice, fee reminder or event message to parents over WhatsApp or SMS. Every
          student with a phone number on record is reachable from here.
        </div>

        {/* ------------------- Compose ------------------- */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="size-4 text-primary" />
              Compose message
            </CardTitle>
            <CardDescription>
              Choose who receives it, write the text, and send — delivery is handled in the
              background.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Audience */}
            <div className="grid gap-3">
              <Label className="text-xs font-medium text-muted-foreground">Send to</Label>
              <div className="grid grid-cols-3 gap-1 rounded-lg border bg-secondary/50 p-1">
                {(
                  [
                    { value: "all", label: "All parents", icon: Users },
                    { value: "class", label: "One class", icon: School },
                    { value: "students", label: "Pick students", icon: Check },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAudience(option.value)}
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold transition-colors",
                      audience === option.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background",
                    )}
                  >
                    <option.icon className="size-3.5" />
                    <span className="truncate">{option.label}</span>
                  </button>
                ))}
              </div>

              {audience === "class" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="msg-class" className="text-xs font-medium text-muted-foreground">
                      Class
                    </Label>
                    <Select
                      value={classId}
                      onValueChange={(value) => {
                        setClassId(value);
                        setSection("all");
                      }}
                    >
                      <SelectTrigger id="msg-class">
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls._id} value={cls._id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="msg-section"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Section
                    </Label>
                    <Select
                      value={section}
                      onValueChange={setSection}
                      disabled={!selectedClass}
                    >
                      <SelectTrigger id="msg-section">
                        <SelectValue placeholder="All sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All sections</SelectItem>
                        {sectionOptions.map((sectionName) => (
                          <SelectItem key={sectionName} value={sectionName}>
                            Section {sectionName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {audience === "students" && (
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search by name, roll number or class…"
                      className="pl-9"
                      aria-label="Search students"
                    />
                  </div>
                  <div className="overflow-hidden rounded-lg border">
                    <div className="flex items-center justify-between border-b bg-secondary/40 px-3 py-2">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                        <Checkbox
                          checked={
                            filteredStudents.length > 0 &&
                            filteredStudents.every((s) => selectedIds.has(s._id))
                          }
                          onCheckedChange={toggleAllFiltered}
                        />
                        Select all {filteredStudents.length > 0 && `(${filteredStudents.length})`}
                      </label>
                      <span className="text-xs text-muted-foreground">
                        {selectedIds.size} selected
                      </span>
                    </div>
                    <ul className="max-h-64 divide-y overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                          No students match your search.
                        </li>
                      ) : (
                        filteredStudents.map((student) => (
                          <li key={student._id}>
                            <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors hover:bg-accent/50">
                              <Checkbox
                                checked={selectedIds.has(student._id)}
                                onCheckedChange={() => toggleStudent(student._id)}
                              />
                              <span className="min-w-0 flex-1 leading-tight">
                                <span className="block truncate text-sm font-medium">
                                  {student.name}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {student.className} · Section {student.section} · Roll{" "}
                                  {student.rollNumber}
                                </span>
                              </span>
                              {student.phone ? (
                                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                  {student.phone}
                                </span>
                              ) : (
                                <span className="shrink-0 text-[10px] text-red-400">
                                  No phone
                                </span>
                              )}
                            </label>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Recipient preview */}
              {preview === undefined ? (
                <div className="flex h-10 items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading recipients…
                </div>
              ) : preview.recipients.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {audience === "class" && !classId
                    ? "Choose a class to see who will be messaged."
                    : audience === "students" && selectedIds.size === 0
                      ? "Pick students to see who will be messaged."
                      : "No active students match this audience."}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                    {preview.recipients.length} student{preview.recipients.length === 1 ? "" : "s"}{" "}
                    in scope
                  </Badge>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    {preview.withPhone} with phone
                  </Badge>
                  {preview.withoutPhone > 0 && (
                    <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">
                      {preview.withoutPhone} without phone — skipped
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Channel + body */}
            <div className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="grid gap-1.5">
                  <Label htmlFor="msg-body" className="text-xs font-medium text-muted-foreground">
                    Message
                  </Label>
                  <Textarea
                    id="msg-body"
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={
                      channel === "whatsapp"
                        ? "e.g. Dear parents, school will close at 1:00 pm tomorrow due to the staff meeting. — Leads School System"
                        : "e.g. Dear parent, your child's monthly fee is due. Please pay at the school office. — Leads School System"
                    }
                    maxLength={MAX_LENGTH}
                  />
                  <p
                    className={cn(
                      "text-right text-[11px]",
                      body.length > MAX_LENGTH - 100 ? "font-semibold text-amber-600" : "text-muted-foreground",
                    )}
                  >
                    {body.length} / {MAX_LENGTH} characters
                    {channel === "sms" && body.length > 160
                      ? " · sent as multiple SMS parts"
                      : ""}
                  </p>
                </div>
                <div className="grid gap-1.5 sm:w-44">
                  <Label className="text-xs font-medium text-muted-foreground">Via</Label>
                  <div className="grid grid-cols-1 gap-1 rounded-lg border bg-secondary/50 p-1">
                    <button
                      type="button"
                      onClick={() => setChannel("whatsapp")}
                      className={cn(
                        "flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold transition-colors",
                        channel === "whatsapp"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-background",
                      )}
                    >
                      <MessageCircle className="size-3.5" />
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setChannel("sms")}
                      className={cn(
                        "flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-semibold transition-colors",
                        channel === "sms"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-background",
                      )}
                    >
                      <MessageSquare className="size-3.5" />
                      SMS
                    </button>
                  </div>
                  <p className="text-[11px] leading-4 text-muted-foreground">
                    {channel === "whatsapp"
                      ? "Delivered via WhatsApp (best for rich text)."
                      : "Plain SMS — long texts are sent in parts."}
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  className="cursor-pointer"
                  disabled={!canSend || sending}
                  onClick={() => setConfirmOpen(true)}
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {sending ? "Sending…" : `Send to ${recipientCount} parent${recipientCount === 1 ? "" : "s"}`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ------------------- History ------------------- */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Recent messages</h2>
            {(messages?.length ?? 0) > 0 && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {messages?.length}
              </span>
            )}
          </div>

          {messages === undefined ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquareText className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold">No messages sent yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sent messages and their delivery status will appear here.
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {(messages ?? []).map((message) => (
                <MessageRow key={message._id} message={message} />
              ))}
            </ul>
          )}

          {unconfigured && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              <strong>Twilio is not configured yet.</strong> Add{" "}
              <code className="font-mono">TWILIO_ACCOUNT_SID</code>,{" "}
              <code className="font-mono">TWILIO_AUTH_TOKEN</code> and{" "}
              <code className="font-mono">TWILIO_PHONE_NUMBER</code> in the project Keys tab —
              messages queue anyway, and failed recipients can be retried with one click once
              configured.
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Send {channel === "whatsapp" ? "WhatsApp" : "SMS"} message?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will send your message to <span className="font-semibold text-foreground">{recipientCount} parent{recipientCount === 1 ? "" : "s"}</span>{" "}
              ({audienceLabel}){preview && preview.withoutPhone > 0 ? ` — ${preview.withoutPhone} student${preview.withoutPhone === 1 ? "" : "s"} without a phone number will be skipped` : ""}.
              Messages are billed to your Twilio account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-40 overflow-y-auto rounded-lg border bg-secondary/40 px-3 py-2 text-xs leading-5">
            {body.trim() || <span className="text-muted-foreground">Message is empty.</span>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={sending || !canSend}
              onClick={async (event) => {
                event.preventDefault();
                await handleSend();
              }}
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {sending ? "Sending…" : `Send to ${recipientCount} parent${recipientCount === 1 ? "" : "s"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* No-phone explanation */}
      {preview !== undefined && preview.withoutPhone > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
          <UserX className="mt-0.5 size-4 shrink-0" />
          <span>
            {preview.withoutPhone} student{preview.withoutPhone === 1 ? "" : "s"} in the selected
            audience don&apos;t have a valid phone number on their record and won&apos;t receive
            this message. Add a phone number on the Students page to reach them.
          </span>
        </div>
      )}
    </AppShell>
  );
}
