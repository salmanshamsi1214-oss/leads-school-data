import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  isSchoolUser,
  requireOfficeUser,
  requireTeacherManager,
} from "./permissions";
import { attendanceStatusValidator } from "./schema";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const validateDate = (date: string) => {
  if (!DATE_RE.test(date)) {
    throw new ConvexError("Date must be in YYYY-MM-DD format.");
  }
};

export const list = query({
  args: {
    status: v.optional(v.union(v.literal("active"), v.literal("left"))),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    const [teachers, classes] = await Promise.all([
      ctx.db.query("teachers").collect(),
      ctx.db.query("classes").collect(),
    ]);
    const classMap = new Map(classes.map((cls) => [cls._id, cls.name]));

    let rows = teachers;
    if (args.status !== undefined) {
      rows = rows.filter((t) => t.status === args.status);
    }
    const search = args.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          (t.subject ?? "").toLowerCase().includes(search) ||
          (t.phone ?? "").includes(search),
      );
    }

    return rows
      .map((t) => ({
        ...t,
        className: t.classId ? (classMap.get(t.classId) ?? "—") : "—",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Teacher attendance records for one date, keyed by teacher id. */
export const attendanceByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return {};
    if (!DATE_RE.test(args.date)) return {};
    const records = await ctx.db
      .query("teacherAttendance")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .collect();
    const result: Record<string, { status: string; markedBy: string }> = {};
    for (const record of records) {
      result[record.teacherId] = {
        status: record.status,
        markedBy: record.markedBy,
      };
    }
    return result;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    cnic: v.optional(v.string()),
    email: v.optional(v.string()),
    qualification: v.optional(v.string()),
    subject: v.optional(v.string()),
    designation: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
    joiningDate: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    salary: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireTeacherManager(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError("Teacher name is required.");
    }
    if (args.joiningDate && !DATE_RE.test(args.joiningDate)) {
      throw new ConvexError("Joining date must be in YYYY-MM-DD format.");
    }
    if (args.birthDate && !DATE_RE.test(args.birthDate)) {
      throw new ConvexError("Birth date must be in YYYY-MM-DD format.");
    }
    if (args.classId !== undefined) {
      const cls = await ctx.db.get(args.classId);
      if (cls === null) {
        throw new ConvexError("Selected class no longer exists.");
      }
    }
    return await ctx.db.insert("teachers", {
      name,
      phone: args.phone?.trim() || undefined,
      cnic: args.cnic?.trim() || undefined,
      email: args.email?.trim() || undefined,
      qualification: args.qualification?.trim() || undefined,
      subject: args.subject?.trim() || undefined,
      designation: args.designation?.trim() || undefined,
      classId: args.classId,
      joiningDate: args.joiningDate,
      birthDate: args.birthDate,
      salary: args.salary,
      status: "active",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("teachers"),
    name: v.string(),
    phone: v.optional(v.string()),
    cnic: v.optional(v.string()),
    email: v.optional(v.string()),
    qualification: v.optional(v.string()),
    subject: v.optional(v.string()),
    designation: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
    joiningDate: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    salary: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireTeacherManager(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Teacher not found.");
    }
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError("Teacher name is required.");
    }
    if (args.joiningDate && !DATE_RE.test(args.joiningDate)) {
      throw new ConvexError("Joining date must be in YYYY-MM-DD format.");
    }
    if (args.birthDate && !DATE_RE.test(args.birthDate)) {
      throw new ConvexError("Birth date must be in YYYY-MM-DD format.");
    }
    await ctx.db.patch(args.id, {
      name,
      phone: args.phone?.trim() || undefined,
      cnic: args.cnic?.trim() || undefined,
      email: args.email?.trim() || undefined,
      qualification: args.qualification?.trim() || undefined,
      subject: args.subject?.trim() || undefined,
      designation: args.designation?.trim() || undefined,
      classId: args.classId,
      joiningDate: args.joiningDate,
      birthDate: args.birthDate,
      salary: args.salary,
    });
  },
});

/** Archive (set to "left") or re-activate a teacher. */
export const setStatus = mutation({
  args: {
    id: v.id("teachers"),
    status: v.union(v.literal("active"), v.literal("left")),
  },
  handler: async (ctx, args) => {
    await requireTeacherManager(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Teacher not found.");
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});

const upsertTeacherAttendance = async (
  ctx: MutationCtx,
  userId: Id<"users">,
  teacherId: Id<"teachers">,
  date: string,
  status: "present" | "absent" | "late" | "leave",
) => {
  const existing = await ctx.db
    .query("teacherAttendance")
    .withIndex("by_teacher_date", (q) =>
      q.eq("teacherId", teacherId).eq("date", date),
    )
    .first();
  if (existing !== null) {
    await ctx.db.patch(existing._id, { status, markedBy: userId });
  } else {
    await ctx.db.insert("teacherAttendance", {
      teacherId,
      date,
      status,
      markedBy: userId,
    });
  }
};

/** Bulk upsert teacher attendance for one date. Atomic. */
export const markAll = mutation({
  args: {
    date: v.string(),
    entries: v.array(
      v.object({
        teacherId: v.id("teachers"),
        status: attendanceStatusValidator,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficeUser(ctx);
    validateDate(args.date);
    const teacherIds = new Set(args.entries.map((e) => e.teacherId));
    if (teacherIds.size !== args.entries.length) {
      throw new ConvexError("Duplicate teacher entries in the same submission.");
    }
    for (const entry of args.entries) {
      const teacher = await ctx.db.get(entry.teacherId);
      if (teacher === null) {
        throw new ConvexError("One of the selected teachers no longer exists.");
      }
    }
    for (const entry of args.entries) {
      await upsertTeacherAttendance(
        ctx,
        user._id,
        entry.teacherId,
        args.date,
        entry.status,
      );
    }
    return args.entries.length;
  },
});

/** List leave requests for a teacher. */
export const leaveRequests = query({
  args: { teacherId: v.id("teachers") },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];
    return ctx.db
      .query("leaveRequests")
      .withIndex("by_teacher", (q) => q.eq("teacherId", args.teacherId))
      .order("desc")
      .collect();
  },
});
