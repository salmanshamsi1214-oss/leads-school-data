import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { isSchoolUser, requireOfficeUser } from "./permissions";

export const MESSAGE_CHANNELS = ["whatsapp", "sms"] as const;
const channelValidator = v.union(v.literal("whatsapp"), v.literal("sms"));

const RECIPIENT_STATES = v.union(
  v.literal("sending"),
  v.literal("sent"),
  v.literal("failed"),
  v.literal("no_phone"),
);
export const recipientStateValidator = RECIPIENT_STATES;

/** Longest message we will send. Twilio SMS concatenates past 160 chars; 1600
 *  is the hard SMS limit, and WhatsApp accepts it too. */
export const MAX_MESSAGE_LENGTH = 1600;

/**
 * Audience selector for a message: every active parent, one class (optionally
 * a single section), or an explicit list of students.
 */
export const messageScopeValidator = v.union(
  v.object({ type: v.literal("all") }),
  v.object({
    type: v.literal("class"),
    classId: v.id("classes"),
    section: v.optional(v.string()),
  }),
  v.object({ type: v.literal("students"), studentIds: v.array(v.id("students")) }),
);

/**
 * Normalizes a Pakistani mobile number to E.164 (+92...). Accepts the formats
 * used on student records: "0332-6241440", "03326241440", "3326241440",
 * "923326241440" or "+923326241440". Returns null when the number doesn't
 * look like a valid Pakistani mobile. (Duplicated from sms.ts — node-runtime
 * files can't be imported from the browser-runtime bundle.)
 */
const normalizePhone = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("923")) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith("3")) return `+92${digits}`;
  if (digits.length === 11 && digits.startsWith("92")) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return null;
};

type RecipientRow = {
  studentId: Id<"students">;
  name: string;
  rollNumber: string;
  className: string;
  section: string;
  phone: string;
  normalized: string | null;
};

/**
 * Resolves an audience scope to the matching active students, joined with
 * their class names. Shared by the preview query and the send mutation so the
 * office sees exactly the same list it is about to message.
 */
const resolveScope = async (
  ctx: QueryCtx,
  scope: {
    type: "all" | "class" | "students";
    classId?: Id<"classes">;
    section?: string;
    studentIds?: Id<"students">[];
  },
): Promise<RecipientRow[]> => {
  const [students, classes] = await Promise.all([
    ctx.db.query("students").collect(),
    ctx.db.query("classes").collect(),
  ]);
  const classMap = new Map(classes.map((cls) => [cls._id, cls.name]));
  const active = students.filter((s) => s.status === "active");

  let selected = active;
  if (scope.type === "class") {
    selected = active.filter(
      (s) =>
        s.classId === scope.classId &&
        (scope.section === undefined || scope.section === "" || s.section === scope.section),
    );
  } else if (scope.type === "students") {
    const ids = new Set(scope.studentIds);
    selected = active.filter((s) => ids.has(s._id));
  }

  return selected.map((student) => ({
    studentId: student._id,
    name: student.name,
    rollNumber: student.rollNumber,
    className: classMap.get(student.classId) ?? "—",
    section: student.section,
    phone: student.phone ?? "",
    normalized: normalizePhone(student.phone ?? ""),
  }));
};

const describeScope = (
  scope: { type: string; classId?: Id<"classes">; section?: string },
  classNameById: Map<Id<"classes">, string>,
  count: number,
): string => {
  if (scope.type === "all") return `All parents · ${count} student${count === 1 ? "" : "s"}`;
  if (scope.type === "class") {
    const name = scope.classId ? (classNameById.get(scope.classId) ?? "Class") : "Class";
    const section = scope.section ? ` · Section ${scope.section}` : "";
    return `${name}${section} · ${count} student${count === 1 ? "" : "s"}`;
  }
  return `${count} selected student${count === 1 ? "" : "s"}`;
};

/** Recipient preview for the compose form: who will receive the message. */
export const recipientsPreview = query({
  args: { scope: messageScopeValidator },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return { recipients: [], withPhone: 0, withoutPhone: 0 };
    const rows = await resolveScope(ctx, args.scope);
    const recipients = rows.map((row) => ({
      studentId: row.studentId,
      name: row.name,
      rollNumber: row.rollNumber,
      className: row.className,
      section: row.section,
      phone: row.normalized ?? "",
      sendable: row.normalized !== null,
    }));
    return {
      recipients,
      withPhone: recipients.filter((r) => r.sendable).length,
      withoutPhone: recipients.filter((r) => !r.sendable).length,
    };
  },
});

/**
 * Sends a bulk message to the selected audience. Creates the message and its
 * recipient rows, then hands delivery to the background action so the office
 * UI returns immediately; per-recipient status updates reactively as Twilio
 * responds.
 */
export const send = mutation({
  args: {
    body: v.string(),
    channel: channelValidator,
    scope: messageScopeValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireOfficeUser(ctx);
    const body = args.body.trim();
    if (body.length === 0) {
      throw new ConvexError("Write a message before sending.");
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      throw new ConvexError(
        `Message is too long — keep it under ${MAX_MESSAGE_LENGTH} characters.`,
      );
    }

    const [rows, classes] = await Promise.all([
      resolveScope(ctx, args.scope),
      ctx.db.query("classes").collect(),
    ]);
    if (rows.length === 0) {
      throw new ConvexError("No students match the selected audience.");
    }

    const classNameById = new Map(classes.map((cls) => [cls._id, cls.name]));
    let total = 0;
    let noPhoneCount = 0;
    const recipients = rows.map((row) => {
      if (row.normalized === null) {
        noPhoneCount += 1;
        return { ...row, phone: "", state: "no_phone" as const };
      }
      total += 1;
      return { ...row, phone: row.normalized, state: "sending" as const };
    });
    if (total === 0) {
      throw new ConvexError(
        "None of the selected students have a valid phone number on record.",
      );
    }

    const messageId = await ctx.db.insert("messages", {
      body,
      channel: args.channel,
      target: describeScope(args.scope, classNameById, rows.length),
      state: "sending",
      total,
      sentCount: 0,
      failedCount: 0,
      noPhoneCount,
      createdBy: user._id,
    });
    for (const recipient of recipients) {
      await ctx.db.insert("messageRecipients", {
        messageId,
        studentId: recipient.studentId,
        name: recipient.name,
        rollNumber: recipient.rollNumber,
        className: recipient.className,
        section: recipient.section,
        phone: recipient.phone,
        state: recipient.state,
      });
    }

    await ctx.scheduler.runAfter(0, internal.sms.sendMessageBatch, { messageId });
    return { messageId, recipientCount: total, noPhoneCount };
  },
});

/** Recent messages, newest first, joined with the sender's name. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return [];
    const messages = await ctx.db.query("messages").order("desc").collect();
    if (messages.length === 0) return [];
    const users = await ctx.db.query("users").collect();
    const userMap = new Map(
      users.map((u) => [u._id, u.name ?? u.email ?? "School office"]),
    );
    return messages.map((message) => ({
      ...message,
      createdByName: userMap.get(message.createdBy) ?? "School office",
    }));
  },
});

/** A single message with its recipient outcomes. */
export const details = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;
    const message = await ctx.db.get(args.messageId);
    if (message === null) return null;
    const [recipients, creator] = await Promise.all([
      ctx.db
        .query("messageRecipients")
        .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
        .collect(),
      ctx.db.get(message.createdBy),
    ]);
    recipients.sort(
      (a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name),
    );
    return {
      message,
      recipients,
      createdByName: creator?.name ?? creator?.email ?? "School office",
    };
  },
});

/**
 * Re-queues every failed recipient of a message (e.g. after a Twilio outage or
 * a fixed config) and schedules delivery again. "No phone" recipients are
 * permanent and are never retried.
 */
export const resendFailed = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    await requireOfficeUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (message === null) {
      throw new ConvexError("Message not found.");
    }
    const recipients = await ctx.db
      .query("messageRecipients")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    const retryable = recipients.filter((r) => r.state === "failed");
    if (retryable.length === 0) {
      throw new ConvexError("Nothing to resend — no failed recipients.");
    }
    for (const recipient of retryable) {
      await ctx.db.patch(recipient._id, { state: "sending", error: undefined });
    }
    await ctx.db.patch(args.messageId, {
      state: "sending",
      error: undefined,
      sentCount: 0,
      failedCount: 0,
    });
    await ctx.scheduler.runAfter(0, internal.sms.sendMessageBatch, {
      messageId: args.messageId,
      recipientIds: retryable.map((r) => r._id),
    });
    return retryable.length;
  },
});

/* ---------------- Internal helpers used by the send action ---------------- */

/** Authless message lookup for the background send action. */
export const getMessage = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => await ctx.db.get(args.messageId),
});

/** Authless recipient lookup; filters to the given ids when resending. */
export const getRecipients = internalQuery({
  args: {
    messageId: v.id("messages"),
    recipientIds: v.optional(v.array(v.id("messageRecipients"))),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("messageRecipients")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    if (args.recipientIds === undefined) return rows;
    const ids = new Set(args.recipientIds);
    return rows.filter((row) => ids.has(row._id));
  },
});

/** Records one recipient's delivery outcome. */
export const updateRecipient = internalMutation({
  args: {
    id: v.id("messageRecipients"),
    state: RECIPIENT_STATES,
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (existing === null) return;
    await ctx.db.patch(args.id, {
      state: args.state,
      ...(args.error !== undefined ? { error: args.error } : {}),
    });
  },
});

/**
 * Recomputes a message's totals and terminal state from its recipient rows.
 * Runs after each delivery pass so partial resends keep the numbers right.
 */
export const recomputeMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (message === null) return;
    const recipients = await ctx.db
      .query("messageRecipients")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    const sentCount = recipients.filter((r) => r.state === "sent").length;
    const failedCount = recipients.filter((r) => r.state === "failed").length;
    const noPhoneCount = recipients.filter((r) => r.state === "no_phone").length;
    const state =
      failedCount === 0
        ? sentCount > 0
          ? "sent"
          : "failed"
        : sentCount > 0
          ? "partial"
          : "failed";
    const patch: {
      state: typeof state;
      total: number;
      sentCount: number;
      failedCount: number;
      noPhoneCount: number;
      error?: string;
    } = {
      state,
      total: recipients.length - noPhoneCount,
      sentCount,
      failedCount,
      noPhoneCount,
    };
    if (args.error !== undefined) {
      patch.error = args.error;
    } else if (state !== "failed") {
      patch.error = undefined;
    }
    await ctx.db.patch(args.messageId, patch);
  },
});
