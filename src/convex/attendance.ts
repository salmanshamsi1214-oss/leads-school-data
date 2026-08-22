import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { isSchoolUser, requireSchoolUser } from "./permissions";
import { attendanceStatusValidator } from "./schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Validates a 24-hour "HH:MM" arrival time, or throws. */
const validateArrivalTime = (time: string) => {
  if (!TIME_RE.test(time)) {
    throw new ConvexError("Arrival time must be in HH:MM format (e.g. 08:47).");
  }
  const [hour, minute] = time.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new ConvexError("Arrival time must be a valid 24-hour time.");
  }
};

/** Minutes from gateTime to arrivalTime; negative when before the gate. */
const minutesBetween = (arrival: string, gate: string) => {
  const [ah, am] = arrival.split(":").map(Number);
  const [bh, bm] = gate.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
};

/** Escalation level from a student's late count this month. */
const escalationFor = (count: number) => {
  if (count >= 8) return { level: "meeting", label: "Meeting Request" };
  if (count >= 5) return { level: "alert", label: "Parent + Principal Alert" };
  if (count >= 3) return { level: "warning", label: "Warning" };
  return { level: "none", label: "—" };
};

/**
 * Validates an ISO date string and rejects dates in the future. A one-day
 * buffer is allowed so that a school in a timezone ahead of UTC can still
 * mark "today" while the server clock is a day behind.
 */
const validateDate = (date: string) => {
  if (!DATE_RE.test(date)) {
    throw new ConvexError("Date must be in YYYY-MM-DD format.");
  }
  const [year, month, day] = date.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ConvexError("Date is not a valid calendar date.");
  }
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ConvexError("Date is not a valid calendar date.");
  }
  const today = new Date();
  const tomorrow = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1),
  );
  if (parsed.getTime() > tomorrow.getTime()) {
    throw new ConvexError("Attendance cannot be marked for a future date.");
  }
};

/**
 * Queues a WhatsApp alert per absent/late/leave student with a reason, via
 * the scheduler. Runs inside the gated mutation so only school staff can
 * trigger sends; the action itself is internal and needs no auth.
 * Returns how many alerts were queued.
 */
const queueAttendanceAlerts = async (
  ctx: MutationCtx,
  date: string,
  rows: { studentId: Id<"students">; status: "present" | "absent" | "late" | "leave"; remarks: string }[],
  channel: "whatsapp" | "sms" = "whatsapp",
) => {
  const alertable = rows.filter(
    (row) => row.status !== "present" && row.remarks.trim().length > 0,
  );
  if (alertable.length === 0) return 0;

  const students = await Promise.all(
    alertable.map((row) => ctx.db.get(row.studentId)),
  );
  const studentById = new Map(
    students
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => [s._id, s]),
  );
  const classIds = Array.from(
    new Set(Array.from(studentById.values()).map((s) => s.classId)),
  );
  const classDocs = await Promise.all(classIds.map((id) => ctx.db.get(id)));
  const classNameById = new Map(
    classDocs
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .map((c) => [c._id, c.name]),
  );

  const entries = alertable.flatMap((row) => {
    const student = studentById.get(row.studentId);
    if (student === undefined) return [];
    return [
      {
        studentId: row.studentId,
        status: row.status,
        remarks: row.remarks.trim(),
        name: student.name,
        rollNumber: student.rollNumber,
        section: student.section,
        className: classNameById.get(student.classId) ?? "",
        phone: student.phone ?? "",
      },
    ];
  });
  if (entries.length === 0) return 0;

  await ctx.scheduler.runAfter(0, internal.sms.sendAttendanceAlerts, {
    date,
    channel,
    entries,
  });
  return entries.length;
};

const upsertAttendance = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  studentId: Id<"students">,
  date: string,
  status: "present" | "absent" | "late" | "leave",
  remarks?: string,
  arrivalTime?: string,
) => {
  // Reasons are required for absent / leave / late; store the trimmed text
  // (empty string clears a previously saved reason).
  const reason = remarks?.trim() ?? "";
  const arrival = arrivalTime?.trim() ?? "";
  const existing = await ctx.db
    .query("attendance")
    .withIndex("by_student_date", (q) =>
      q.eq("studentId", studentId).eq("date", date),
    )
    .first();
  if (existing !== null) {
    await ctx.db.patch(existing._id, {
      status,
      remarks: reason,
      ...(arrival ? { arrivalTime: arrival } : {}),
      markedBy: userId,
    });
  } else {
    await ctx.db.insert("attendance", {
      studentId,
      date,
      status,
      ...(reason ? { remarks: reason } : {}),
      ...(arrival ? { arrivalTime: arrival } : {}),
      markedBy: userId,
    });
  }
};

/** Attendance records for one date, keyed by student id. */
export const byDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return {};
    if (!DATE_RE.test(args.date)) return {};
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const result: Record<
      string,
      { status: string; remarks?: string; arrivalTime?: string; markedBy: string }
    > = {};
    for (const record of records) {
      result[record.studentId] = {
        status: record.status,
        remarks: record.remarks ?? undefined,
        arrivalTime: record.arrivalTime ?? undefined,
        markedBy: record.markedBy,
      };
    }
    return result;
  },
});

/** Full attendance history for a single student, oldest first. */
export const byStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_student_date", (q) => q.eq("studentId", args.studentId))
      .collect();
    return records.sort((a, b) => a.date.localeCompare(b.date));
  },
});

/** Mark (or update) attendance for a single student on a date. */
export const mark = mutation({
  args: {
    studentId: v.id("students"),
    date: v.string(),
    status: attendanceStatusValidator,
    arrivalTime: v.optional(v.string()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    validateDate(args.date);
    if (args.arrivalTime !== undefined) {
      validateArrivalTime(args.arrivalTime);
    }
    const student = await ctx.db.get(args.studentId);
    if (student === null) {
      throw new ConvexError("Student not found.");
    }
    await upsertAttendance(
      ctx,
      user._id,
      args.studentId,
      args.date,
      args.status,
      args.remarks,
      args.arrivalTime,
    );
    await queueAttendanceAlerts(ctx, args.date, [
      {
        studentId: args.studentId,
        status: args.status,
        remarks: args.remarks ?? "",
      },
    ]);
  },
});

/** Bulk upsert attendance for many students on one date. Atomic. */
export const markAll = mutation({
  args: {
    date: v.string(),
    entries: v.array(
      v.object({
        studentId: v.id("students"),
        status: attendanceStatusValidator,
        arrivalTime: v.optional(v.string()),
        remarks: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireSchoolUser(ctx);
    validateDate(args.date);
    for (const entry of args.entries) {
      if (entry.arrivalTime !== undefined) {
        validateArrivalTime(entry.arrivalTime);
      }
    }
    const studentIds = new Set(args.entries.map((entry) => entry.studentId));
    if (studentIds.size !== args.entries.length) {
      throw new ConvexError("Duplicate student entries in the same submission.");
    }
    for (const entry of args.entries) {
      const student = await ctx.db.get(entry.studentId);
      if (student === null) {
        throw new ConvexError("One of the selected students no longer exists.");
      }
    }
    for (const entry of args.entries) {
      await upsertAttendance(
        ctx,
        user._id,
        entry.studentId,
        args.date,
        entry.status,
        entry.remarks,
        entry.arrivalTime,
      );
    }
    // Fire WhatsApp alerts to parents of absent/late/leave students. The
    // action dedupes against the attendanceAlerts table, so re-saving the
    // same day never pings a parent twice.
    await queueAttendanceAlerts(
      ctx,
      args.date,
      args.entries.map((entry) => ({
        studentId: entry.studentId,
        status: entry.status,
        remarks: entry.remarks ?? "",
      })),
    );
    return args.entries.length;
  },
});

/**
 * Manually queue (or retry) parent alerts for a date — powers the "Send
 * now" button on the Attendance page. Only absent/late/leave students with
 * a recorded reason are included; already-sent alerts are skipped by the
 * action's dedupe.
 */
export const sendAlerts = mutation({
  args: {
    date: v.string(),
    channel: v.union(v.literal("sms"), v.literal("whatsapp")),
  },
  handler: async (ctx, args) => {
    await requireSchoolUser(ctx);
    validateDate(args.date);
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const rows = records
      .filter((r) => r.status !== "present" && (r.remarks ?? "").trim().length > 0)
      .map((r) => ({
        studentId: r.studentId,
        status: r.status,
        remarks: r.remarks ?? "",
      }));
    return queueAttendanceAlerts(ctx, args.date, rows, args.channel);
  },
});

/**
 * Claims an alert row before sending — the dedupe guard. Returns claimed:
 * false when an alert for this (student, date) is already sending/sent;
 * previously failed alerts are re-claimed so retries work.
 */
export const claimAlert = internalMutation({
  args: {
    studentId: v.id("students"),
    date: v.string(),
    status: attendanceStatusValidator,
    remarks: v.string(),
    channel: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attendanceAlerts")
      .withIndex("by_student_date", (q) =>
        q.eq("studentId", args.studentId).eq("date", args.date),
      )
      .first();
    if (existing !== null) {
      if (existing.state === "sent" || existing.state === "sending") {
        return { claimed: false, reason: existing.state };
      }
      await ctx.db.patch(existing._id, {
        state: "sending",
        status: args.status,
        remarks: args.remarks,
        channel: args.channel,
        error: undefined,
        sentAt: undefined,
      });
      return { claimed: true, reason: "retry" };
    }
    await ctx.db.insert("attendanceAlerts", {
      studentId: args.studentId,
      date: args.date,
      status: args.status,
      remarks: args.remarks,
      channel: args.channel,
      state: "sending",
    });
    return { claimed: true, reason: "new" };
  },
});

/** Records the send outcome on the alert row claimed earlier. */
export const finishAlert = internalMutation({
  args: {
    studentId: v.id("students"),
    date: v.string(),
    state: v.union(v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attendanceAlerts")
      .withIndex("by_student_date", (q) =>
        q.eq("studentId", args.studentId).eq("date", args.date),
      )
      .first();
    if (existing === null) return;
    await ctx.db.patch(existing._id, {
      state: args.state,
      ...(args.error !== undefined ? { error: args.error } : {}),
      ...(args.sentAt !== undefined ? { sentAt: args.sentAt } : {}),
    });
  },
});

/** Parent alert log for a date, joined with student names. */
export const alertsByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    if (!DATE_RE.test(args.date)) return [];
    const rows = await ctx.db
      .query("attendanceAlerts")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    rows.sort((a, b) => a._creationTime - b._creationTime);
    const students = await Promise.all(rows.map((r) => ctx.db.get(r.studentId)));
    const nameById = new Map(
      students
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s.name]),
    );
    return rows.map((row) => ({
      studentId: row.studentId,
      studentName: nameById.get(row.studentId) ?? "Unknown",
      status: row.status,
      remarks: row.remarks,
      channel: row.channel,
      state: row.state,
      error: row.error ?? undefined,
      sentAt: row.sentAt ?? undefined,
    }));
  },
});

/**
 * Per-student attendance summary for a class/section over a date range.
 * Returns one row per student plus a list of school days in the range.
 */
export const classReport = query({
  args: {
    classId: v.id("classes"),
    section: v.optional(v.string()),
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return { rows: [], days: [] };

    const students = (await ctx.db
      .query("students")
      .withIndex("by_class_section", (q) => q.eq("classId", args.classId))
      .collect()).filter(
      (s) =>
        s.status === "active" &&
        (args.section === undefined || args.section === "" || s.section === args.section),
    );

    const records = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) =>
        q.gte("date", args.from).lte("date", args.to),
      )
      .collect();

    const byStudent = new Map<string, typeof records>();
    for (const record of records) {
      if (!byStudent.has(record.studentId)) {
        byStudent.set(record.studentId, []);
      }
      byStudent.get(record.studentId)!.push(record);
    }

    const days = Array.from(
      new Set(records.map((r) => r.date)),
    ).sort();

    const rows = students.map((student) => {
      const mine = byStudent.get(student._id) ?? [];
      const present = mine.filter((r) => r.status === "present").length;
      const absent = mine.filter((r) => r.status === "absent").length;
      const late = mine.filter((r) => r.status === "late").length;
      const leave = mine.filter((r) => r.status === "leave").length;
      const marked = mine.length;
      return {
        studentId: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        section: student.section,
        present,
        absent,
        late,
        leave,
        marked,
      };
    });

    return { rows, days };
  },
});

/** Monthly summary (counts + per-day breakdown) for one student. */
export const studentMonthly = query({
  args: {
    studentId: v.id("students"),
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return { records: [], totals: null };
    const monthStr = String(args.month).padStart(2, "0");
    const from = `${args.year}-${monthStr}-01`;
    const lastDay = new Date(
      Date.UTC(args.year, args.month, 0),
    ).getUTCDate();
    const to = `${args.year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

    const records = await ctx.db
      .query("attendance")
      .withIndex("by_student_date", (q) =>
        q.eq("studentId", args.studentId).gte("date", from).lte("date", to),
      )
      .collect();
    records.sort((a, b) => a.date.localeCompare(b.date));

    const totals = {
      present: records.filter((r) => r.status === "present").length,
      absent: records.filter((r) => r.status === "absent").length,
      late: records.filter((r) => r.status === "late").length,
      leave: records.filter((r) => r.status === "leave").length,
    };
    return {
      records: records.map((r) => ({
        date: r.date,
        status: r.status,
        remarks: r.remarks ?? undefined,
      })),
      totals,
    };
  },
});

/**
 * Students marked late on a given date, joined with student + class info,
 * their arrival time, minutes late after the configured gate, the count of
 * late arrivals this month, and the matching escalation level.
 * Powers the "Late Comers" page.
 */
export const lateComers = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    if (!DATE_RE.test(args.date)) return [];

    const [records, students, classes, gateSetting] = await Promise.all([
      ctx.db
        .query("attendance")
        .withIndex("by_date", (q) => q.eq("date", args.date))
        .collect(),
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
      ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "lateGateTime"))
        .first(),
    ]);
    const lateRecords = records.filter((r) => r.status === "late");
    if (lateRecords.length === 0) return [];

    const studentById = new Map(students.map((s) => [s._id, s]));
    const classNameById = new Map(classes.map((c) => [c._id, c.name]));
    const gate = gateSetting?.value ?? "08:00";

    // Late count per student for the month of the selected date, up to and
    // including it — drives the escalation level.
    const monthPrefix = args.date.slice(0, 7);
    const monthRecords = await ctx.db
      .query("attendance")
      .withIndex("by_date", (q) =>
        q.gte("date", `${monthPrefix}-01`).lte("date", args.date),
      )
      .collect();
    const lateCountByStudent = new Map<string, number>();
    for (const record of monthRecords) {
      if (record.status !== "late") continue;
      lateCountByStudent.set(
        record.studentId,
        (lateCountByStudent.get(record.studentId) ?? 0) + 1,
      );
    }

    return lateRecords
      .flatMap((record) => {
        const student = studentById.get(record.studentId);
        if (student === undefined) return [];
        const thisMonth = lateCountByStudent.get(record.studentId) ?? 0;
        const arrivalTime = record.arrivalTime ?? null;
        return [
          {
            studentId: student._id,
            name: student.name,
            rollNumber: student.rollNumber,
            section: student.section,
            className: classNameById.get(student.classId) ?? "",
            arrivalTime,
            lateByMinutes:
              arrivalTime === null ? null : Math.max(0, minutesBetween(arrivalTime, gate)),
            remarks: record.remarks ?? "",
            thisMonth,
            escalation: escalationFor(thisMonth),
            phone: student.phone ?? "",
          },
        ];
      })
      .sort((a, b) => {
        const byLate = (b.lateByMinutes ?? 0) - (a.lateByMinutes ?? 0);
        if (byLate !== 0) return byLate;
        const byClass = a.className.localeCompare(b.className);
        if (byClass !== 0) return byClass;
        return a.rollNumber.localeCompare(b.rollNumber);
      });
  },
});

/**
 * Single late record + student + gate details for the parent-alert action.
 * Returns null when there is no late record for that student on that date.
 */
export const lateAlertInfo = query({
  args: { studentId: v.id("students"), date: v.string() },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return null;
    if (!DATE_RE.test(args.date)) return null;
    const record = await ctx.db
      .query("attendance")
      .withIndex("by_student_date", (q) =>
        q.eq("studentId", args.studentId).eq("date", args.date),
      )
      .first();
    if (record === null || record.status !== "late") return null;
    const [student, gateSetting] = await Promise.all([
      ctx.db.get(record.studentId),
      ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "lateGateTime"))
        .first(),
    ]);
    if (student === null) return null;
    const cls = await ctx.db.get(student.classId);
    const gate = gateSetting?.value ?? "08:00";
    const arrivalTime = record.arrivalTime ?? null;
    return {
      studentId: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      section: student.section,
      className: cls?.name ?? "",
      phone: student.phone ?? "",
      arrivalTime,
      lateByMinutes:
        arrivalTime === null ? null : Math.max(0, minutesBetween(arrivalTime, gate)),
      remarks: record.remarks ?? "",
    };
  },
});
