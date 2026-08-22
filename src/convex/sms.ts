"use node";

import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import axios from "axios";
import { api, internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { attendanceStatusValidator } from "./schema";

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
  other: "Other",
};

/** The shape returned by fees.receipt that this action consumes. */
type ReceiptRow = {
  _id: Id<"feePayments">;
  receiptNo: string;
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
  period: string;
  amount: number;
  method: string;
  date: string;
  studentPhone: string;
};

const pkr = (amount: number) =>
  `Rs ${Math.round(amount).toLocaleString("en-PK")}`;

const monthLabel = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return period;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** "08:48" -> "8:48 AM" (24h HH:MM input, 12h display). */
const timeLabel = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
};

/**
 * Normalizes a Pakistani mobile number to E.164 (+92...), accepting the
 * formats used on student records: "0332-6241440", "03326241440",
 * "3326241440", "923326241440" or "+923326241440". Returns null when the
 * number doesn't look like a valid Pakistani mobile.
 */
const normalizeE164 = (raw: string): string | null => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("923")) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith("3")) return `+92${digits}`;
  if (digits.length === 11 && digits.startsWith("92")) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+92${digits.slice(1)}`;
  return null;
};

/** Accepts "whatsapp:+92..." or a bare E.164/number and prefixes if needed. */
const whatsappAddress = (value: string) =>
  value.startsWith("whatsapp:") ? value : `whatsapp:${value}`;

/**
 * POSTs a message to the Twilio Messages API. Returns success/sid or a
 * human-readable failure message instead of throwing.
 */
const postTwilioMessage = async (
  accountSid: string,
  authToken: string,
  params: Record<string, string>,
): Promise<{ success: boolean; sid?: string; message?: string }> => {
  try {
    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams(params),
      { auth: { username: accountSid, password: authToken } },
    );
    return { success: true, sid: String(response.data.sid ?? "") };
  } catch (error) {
    const message = axios.isAxiosError(error)
      ? String(error.response?.data?.message ?? error.message)
      : error instanceof Error
        ? error.message
        : "Unknown error";
    return { success: false, message };
  }
};

const buildReceiptMessage = (payment: {
  receiptNo: string;
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
  period: string;
  amount: number;
  method: string;
  date: string;
}) =>
  [
    "LEADS School System - Zeenat Campus",
    `Fee receipt ${payment.receiptNo}`,
    `${payment.studentName} (Roll ${payment.rollNumber || "-"})`,
    `${payment.className} - Section ${payment.section}`,
    `Month: ${monthLabel(payment.period)}`,
    `Amount: ${pkr(payment.amount)} (${METHOD_LABELS[payment.method] ?? payment.method})`,
    `Date: ${dateLabel(payment.date)}`,
    "Thank you. Office: 0332-6241440",
  ].join("\n");

/**
 * Sends a receipt copy to the guardian's phone number via Twilio SMS or
 * WhatsApp. Returns success/error instead of throwing so the fee recording
 * flow is never blocked by a messaging problem.
 *
 * Env vars (set in the project Keys/API keys tab):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (SMS sender)
 *   TWILIO_WHATSAPP_FROM (optional, WhatsApp sender; defaults to the SMS number)
 *   TWILIO_WHATSAPP_CONTENT_SID (optional, approved WhatsApp template)
 *
 * WhatsApp note: Meta requires an approved template for business-initiated
 * messages. Without TWILIO_WHATSAPP_CONTENT_SID the message is sent freeform,
 * which Twilio only delivers inside the 24-hour customer service window or
 * the sandbox. Template variables map to {{1}} receipt no, {{2}} student
 * name, {{3}} amount, {{4}} month.
 */
export const sendReceiptCopy = action({
  args: {
    paymentId: v.id("feePayments"),
    channel: v.union(v.literal("sms"), v.literal("whatsapp")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("You must be signed in to send a receipt.");
    }

    // fees.receipt is school-staff gated, and runQuery inherits this
    // action's authentication, so a non-staff caller gets null here.
    // (The explicit type breaks a TS circular-inference issue when an
    // action references the generated api object via runQuery.)
    const payment = (await ctx.runQuery(api.fees.receipt, {
      paymentId: args.paymentId,
    })) as ReceiptRow | null;
    if (payment === null) {
      throw new ConvexError(
        "Receipt not found, or this account is not allowed to send it.",
      );
    }

    const to = normalizeE164(payment.studentPhone ?? "");
    if (to === null) {
      return {
        success: false,
        channel: args.channel,
        error: "no_phone",
        to: null,
        message: `No valid phone number on record for ${payment.studentName}.`,
      };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !fromNumber) {
      return {
        success: false,
        channel: args.channel,
        error: "unconfigured",
        to,
        message:
          "Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER in the project Keys.",
      };
    }

    const isWhatsApp = args.channel === "whatsapp";
    const from = isWhatsApp
      ? whatsappAddress(process.env.TWILIO_WHATSAPP_FROM ?? fromNumber)
      : fromNumber;
    const toAddress = isWhatsApp ? whatsappAddress(to) : to;

    const params: Record<string, string> = {
      To: toAddress,
      From: from,
    };
    const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID;
    if (isWhatsApp && contentSid) {
      // Approved Meta template; variables must match the template's {{1}}…{{n}}.
      params.ContentSid = contentSid;
      params.ContentVariables = JSON.stringify({
        "1": payment.receiptNo,
        "2": payment.studentName,
        "3": pkr(payment.amount),
        "4": monthLabel(payment.period),
      });
    } else {
      params.Body = buildReceiptMessage(payment);
    }

    const result = await postTwilioMessage(accountSid, authToken, params);
    if (result.success) {
      return { success: true, channel: args.channel, to, sid: result.sid ?? "" };
    }
    return {
      success: false,
      channel: args.channel,
      error: "api_error",
      to,
      message: result.message ?? "Unknown error",
    };
  },
});

/** One parent alert targeted at a student; enriched by the scheduling mutation. */
type AttendanceAlertEntry = {
  studentId: Id<"students">;
  status: "present" | "absent" | "late" | "leave";
  remarks: string;
  name: string;
  rollNumber: string;
  section: string;
  className: string;
  phone: string;
};

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late Comer",
  leave: "Leave",
};

const buildAttendanceMessage = (entry: AttendanceAlertEntry, date: string) =>
  [
    "LEADS School System - Zeenat Campus",
    `Attendance Alert - ${dateLabel(date)}`,
    `${entry.name} (Roll ${entry.rollNumber || "-"})`,
    `${entry.className} - Section ${entry.section}`,
    `Status: ${ATTENDANCE_STATUS_LABELS[entry.status] ?? entry.status}`,
    `Reason: ${entry.remarks}`,
    "Thank you. Office: 0332-6241440",
  ].join("\n");

/**
 * Sends parent WhatsApp (or SMS) alerts for one attendance date. Invoked only
 * via ctx.scheduler from the school-user-gated attendance mutations, so it is
 * an internalAction: clients can't call it directly and scheduled functions
 * carry no auth anyway.
 *
 * Duplicates are prevented by attendance.claimAlert, which records a
 * "sending" row per (student, date) and refuses to re-claim already sent
 * alerts; a previous failure is re-claimed, so retries work.
 *
 * Env vars (project Keys/API keys tab):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 *   TWILIO_WHATSAPP_FROM (optional; defaults to the SMS number)
 */
export const sendAttendanceAlerts = internalAction({
  args: {
    date: v.string(), // YYYY-MM-DD
    channel: v.union(v.literal("sms"), v.literal("whatsapp")),
    entries: v.array(
      v.object({
        studentId: v.id("students"),
        status: attendanceStatusValidator,
        remarks: v.string(),
        name: v.string(),
        rollNumber: v.string(),
        section: v.string(),
        className: v.string(),
        phone: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const configured = Boolean(accountSid && authToken && fromNumber);
    const isWhatsApp = args.channel === "whatsapp";

    const results: {
      studentId: Id<"students">;
      outcome: "sent" | "skipped" | "failed";
      reason?: string;
    }[] = [];

    for (const entry of args.entries) {
      const claim = await ctx.runMutation(internal.attendance.claimAlert, {
        studentId: entry.studentId,
        date: args.date,
        status: entry.status,
        remarks: entry.remarks,
        channel: args.channel,
      });
      if (!claim.claimed) {
        results.push({
          studentId: entry.studentId,
          outcome: "skipped",
          reason: claim.reason,
        });
        continue;
      }

      const to = normalizeE164(entry.phone ?? "");
      if (to === null) {
        await ctx.runMutation(internal.attendance.finishAlert, {
          studentId: entry.studentId,
          date: args.date,
          state: "failed",
          error: "no_phone",
        });
        results.push({ studentId: entry.studentId, outcome: "failed", reason: "no_phone" });
        continue;
      }

      if (!configured) {
        await ctx.runMutation(internal.attendance.finishAlert, {
          studentId: entry.studentId,
          date: args.date,
          state: "failed",
          error: "unconfigured",
        });
        results.push({ studentId: entry.studentId, outcome: "failed", reason: "unconfigured" });
        continue;
      }

      const from = isWhatsApp
        ? whatsappAddress(process.env.TWILIO_WHATSAPP_FROM ?? fromNumber!)
        : fromNumber!;
      const toAddress = isWhatsApp ? whatsappAddress(to) : to;
      const sent = await postTwilioMessage(
        accountSid!,
        authToken!,
        {
          To: toAddress,
          From: from,
          Body: buildAttendanceMessage(entry, args.date),
        },
      );
      if (sent.success) {
        await ctx.runMutation(internal.attendance.finishAlert, {
          studentId: entry.studentId,
          date: args.date,
          state: "sent",
          sentAt: Date.now(),
        });
        results.push({ studentId: entry.studentId, outcome: "sent" });
      } else {
        const error = (sent.message ?? "api_error").slice(0, 300);
        await ctx.runMutation(internal.attendance.finishAlert, {
          studentId: entry.studentId,
          date: args.date,
          state: "failed",
          error,
        });
        results.push({ studentId: entry.studentId, outcome: "failed", reason: error });
      }
    }

    return results;
  },
});

/** Builds a fee reminder message for a student's guardian. */
const buildFeeReminderMessage = (data: {
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
  period: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate?: string;
}) =>
  [
    "LEADS School System - Zeenat Campus",
    "Fee Reminder",
    `${data.studentName} (Roll ${data.rollNumber || "-"})`,
    `${data.className} - Section ${data.section}`,
    `Month: ${monthLabel(data.period)}`,
    `Total Fee: ${pkr(data.totalAmount)}`,
    `Paid: ${pkr(data.paidAmount)}`,
    `Outstanding: ${pkr(data.balance)}`,
    data.dueDate ? `Due Date: ${dateLabel(data.dueDate)}` : "",
    "Please clear dues at the earliest.",
    "Office: 0332-6241440",
  ]
    .filter(Boolean)
    .join("\n");

/** Builds a fine/overdue charge alert message for a student's guardian. */
const buildFineAlertMessage = (data: {
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
  period: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  fineAmount: number;
  daysOverdue: number;
  dueDate?: string;
}) =>
  [
    "LEADS School System - Zeenat Campus",
    "⚠️ FEE OVERDUE ALERT",
    `${data.studentName} (Roll ${data.rollNumber || "-"})`,
    `${data.className} - Section ${data.section}`,
    `Month: ${monthLabel(data.period)}`,
    `Outstanding: ${pkr(data.balance)}`,
    `Days Overdue: ${data.daysOverdue} day${data.daysOverdue === 1 ? "" : "s"}`,
    data.fineAmount > 0 ? `Fine Applied: ${pkr(data.fineAmount)}` : "",
    data.dueDate ? `Due Date Was: ${dateLabel(data.dueDate)}` : "",
    "Please clear dues immediately to avoid further charges.",
    "Office: 0332-6241440",
  ]
    .filter(Boolean)
    .join("\n");

/**
 * Sends a fee reminder to a single student's guardian. This is a staff
 * action (explicit button click), so no deduplication.
 */
export const sendFeeReminder = action({
  args: {
    studentId: v.id("students"),
    channel: v.union(v.literal("whatsapp"), v.literal("sms")),
    period: v.string(),
    totalAmount: v.number(),
    paidAmount: v.number(),
    balance: v.number(),
    dueDate: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; channel: string; to: string | null; sid?: string; error?: string; message?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("You must be signed in to send reminders.");
    }

    const student = await ctx.runQuery(api.students.list, { status: "active" });
    const found = student?.find((s) => s._id === args.studentId);
    if (!found) {
      throw new ConvexError("Student not found.");
    }

    const to = normalizeE164(found.phone ?? "");
    if (to === null) {
      return {
        success: false,
        channel: args.channel,
        error: "no_phone",
        to: null,
        message: `No valid phone number on record for ${found.name}.`,
      };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !fromNumber) {
      return {
        success: false,
        channel: args.channel,
        error: "unconfigured",
        to,
        message: "Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER.",
      };
    }

    const isWhatsApp = args.channel === "whatsapp";
    const from = isWhatsApp
      ? whatsappAddress(process.env.TWILIO_WHATSAPP_FROM ?? fromNumber)
      : fromNumber;
    const toAddress = isWhatsApp ? whatsappAddress(to) : to;

    const result = await postTwilioMessage(accountSid, authToken, {
      To: toAddress,
      From: from,
      Body: buildFeeReminderMessage({
        studentName: found.name,
        rollNumber: found.rollNumber,
        className: found.className,
        section: found.section,
        period: args.period,
        totalAmount: args.totalAmount,
        paidAmount: args.paidAmount,
        balance: args.balance,
        dueDate: args.dueDate,
      }),
    });

    if (result.success) {
      return { success: true, channel: args.channel, to, sid: result.sid ?? "" };
    }
    return {
      success: false,
      channel: args.channel,
      error: "api_error",
      to,
      message: result.message ?? "Unknown error",
    };
  },
});

/**
 * Sends a fine/overdue alert to a student's guardian when fees are past due.
 */
export const sendFineAlert = action({
  args: {
    studentId: v.id("students"),
    channel: v.union(v.literal("whatsapp"), v.literal("sms")),
    period: v.string(),
    totalAmount: v.number(),
    paidAmount: v.number(),
    balance: v.number(),
    fineAmount: v.number(),
    daysOverdue: v.number(),
    dueDate: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; channel: string; to: string | null; sid?: string; error?: string; message?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("You must be signed in to send alerts.");
    }

    const students = await ctx.runQuery(api.students.list, { status: "active" });
    const student = students?.find((s) => s._id === args.studentId);
    if (!student) {
      throw new ConvexError("Student not found.");
    }

    const to = normalizeE164(student.phone ?? "");
    if (to === null) {
      return {
        success: false,
        channel: args.channel,
        error: "no_phone",
        to: null,
        message: `No valid phone number on record for ${student.name}.`,
      };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !fromNumber) {
      return {
        success: false,
        channel: args.channel,
        error: "unconfigured",
        to,
        message: "Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER.",
      };
    }

    const isWhatsApp = args.channel === "whatsapp";
    const from = isWhatsApp
      ? whatsappAddress(process.env.TWILIO_WHATSAPP_FROM ?? fromNumber)
      : fromNumber;
    const toAddress = isWhatsApp ? whatsappAddress(to) : to;

    const result = await postTwilioMessage(accountSid, authToken, {
      To: toAddress,
      From: from,
      Body: buildFineAlertMessage({
        studentName: student.name,
        rollNumber: student.rollNumber,
        className: student.className,
        section: student.section,
        period: args.period,
        totalAmount: args.totalAmount,
        paidAmount: args.paidAmount,
        balance: args.balance,
        fineAmount: args.fineAmount,
        daysOverdue: args.daysOverdue,
        dueDate: args.dueDate,
      }),
    });

    if (result.success) {
      return { success: true, channel: args.channel, to, sid: result.sid ?? "" };
    }
    return {
      success: false,
      channel: args.channel,
      error: "api_error",
      to,
      message: result.message ?? "Unknown error",
    };
  },
});

/**
 * Sends an immediate parent alert about a late arrival (the "Text" button
 * on the Late Comers page) via Twilio WhatsApp or SMS. Unlike the scheduled
 * attendance alerts, this is an explicit staff action, so there is no
 * per-day dedupe. Returns success/error instead of throwing.
 */
export const sendLateAlert = action({
  args: {
    studentId: v.id("students"),
    date: v.string(), // YYYY-MM-DD
    channel: v.union(v.literal("whatsapp"), v.literal("sms")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new ConvexError("You must be signed in to do that.");
    }

    // lateAlertInfo is school-staff gated; runQuery inherits this action's
    // authentication, so a non-staff caller gets null here.
    const info = (await ctx.runQuery(api.attendance.lateAlertInfo, {
      studentId: args.studentId,
      date: args.date,
    })) as {
      name: string;
      rollNumber: string;
      className: string;
      section: string;
      phone: string;
      arrivalTime: string | null;
      lateByMinutes: number | null;
      remarks: string;
    } | null;
    if (info === null) {
      throw new ConvexError(
        "No late record found for this student on that date, or this account is not allowed to send it.",
      );
    }

    const to = normalizeE164(info.phone);
    if (to === null) {
      return {
        success: false,
        channel: args.channel,
        error: "no_phone",
        to: null,
        message: `No valid phone number on record for ${info.name}.`,
      };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !fromNumber) {
      return {
        success: false,
        channel: args.channel,
        error: "unconfigured",
        to,
        message:
          "Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER in the project Keys.",
      };
    }

    const isWhatsApp = args.channel === "whatsapp";
    const from = isWhatsApp
      ? whatsappAddress(process.env.TWILIO_WHATSAPP_FROM ?? fromNumber)
      : fromNumber;
    const toAddress = isWhatsApp ? whatsappAddress(to) : to;
    const lines = [
      "LEADS School System - Zeenat Campus",
      `Late Arrival Alert - ${dateLabel(args.date)}`,
      `${info.name} (Roll ${info.rollNumber || "-"})`,
      `${info.className} - Section ${info.section}`,
      info.arrivalTime ? `Arrival: ${timeLabel(info.arrivalTime)}` : "",
      info.lateByMinutes !== null && info.lateByMinutes > 0
        ? `Late by: ${info.lateByMinutes} min`
        : "",
      info.remarks ? `Reason: ${info.remarks}` : "",
      "Thank you. Office: 0332-6241440",
    ].filter(Boolean);

    const result = await postTwilioMessage(accountSid, authToken, {
      To: toAddress,
      From: from,
      Body: lines.join("\n"),
    });
    if (result.success) {
      return { success: true, channel: args.channel, to, sid: result.sid ?? "" };
    }
    return {
      success: false,
      channel: args.channel,
      error: "api_error",
      to,
      message: result.message ?? "Unknown error",
    };
  },
});

/**
 * Delivers a bulk office message (notices, fee reminders, events) to its
 * recipients over Twilio WhatsApp or SMS. Invoked via the scheduler from
 * messages.send / messages.resendFailed, so it is an internalAction and needs
 * no auth.
 *
 * Env vars (project Keys/API keys tab):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 *   TWILIO_WHATSAPP_FROM (optional; defaults to the SMS number)
 */
export const sendMessageBatch = internalAction({
  args: {
    messageId: v.id("messages"),
    recipientIds: v.optional(v.array(v.id("messageRecipients"))),
  },
  handler: async (ctx, args) => {
    const message = await ctx.runQuery(internal.messages.getMessage, {
      messageId: args.messageId,
    });
    if (message === null) {
      return { messageId: args.messageId, sent: 0, failed: 0, reason: "not_found" };
    }
    const recipients = await ctx.runQuery(internal.messages.getRecipients, {
      messageId: args.messageId,
      recipientIds: args.recipientIds,
    });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const configured = Boolean(accountSid && authToken && fromNumber);
    const isWhatsApp = message.channel === "whatsapp";

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      if (recipient.state !== "sending") continue;

      if (!configured) {
        await ctx.runMutation(internal.messages.updateRecipient, {
          id: recipient._id,
          state: "failed",
          error: "unconfigured",
        });
        failed += 1;
        continue;
      }

      const from = isWhatsApp
        ? whatsappAddress(process.env.TWILIO_WHATSAPP_FROM ?? fromNumber!)
        : fromNumber!;
      const toAddress = isWhatsApp ? whatsappAddress(recipient.phone) : recipient.phone;
      const result = await postTwilioMessage(accountSid!, authToken!, {
        To: toAddress,
        From: from,
        Body: message.body,
      });
      if (result.success) {
        await ctx.runMutation(internal.messages.updateRecipient, {
          id: recipient._id,
          state: "sent",
        });
        sent += 1;
      } else {
        const error = (result.message ?? "api_error").slice(0, 300);
        await ctx.runMutation(internal.messages.updateRecipient, {
          id: recipient._id,
          state: "failed",
          error,
        });
        failed += 1;
      }
    }

    await ctx.runMutation(internal.messages.recomputeMessage, {
      messageId: args.messageId,
      ...(configured ? {} : { error: "unconfigured" }),
    });
    return { messageId: args.messageId, sent, failed };
  },
});
