import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { isSchoolUser, requireStudentManager } from "./permissions";
import { studentStatusValidator } from "./schema";

const cleanRoll = (value: string) => value.trim().toUpperCase();

const validateStudentInput = async (
  ctx: MutationCtx,
  args: {
    name: string;
    fatherName: string;
    rollNumber: string;
    classId: Id<"classes">;
    section: string;
    admissionDate?: string;
    birthDate?: string;
    phone?: string;
  },
  excludeStudentId?: string,
) => {
  const name = args.name.trim();
  const fatherName = args.fatherName.trim();
  const rollNumber = cleanRoll(args.rollNumber);
  const section = args.section.trim().toUpperCase();

  if (name.length === 0) {
    throw new ConvexError("Student name is required.");
  }
  if (fatherName.length === 0) {
    throw new ConvexError("Father's name is required.");
  }
  if (rollNumber.length === 0) {
    throw new ConvexError("Roll number is required.");
  }
  if (section.length === 0) {
    throw new ConvexError("Section is required.");
  }
  if (args.admissionDate && !/^\d{4}-\d{2}-\d{2}$/.test(args.admissionDate)) {
    throw new ConvexError("Admission date must be in YYYY-MM-DD format.");
  }
  if (args.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(args.birthDate)) {
    throw new ConvexError("Date of birth must be in YYYY-MM-DD format.");
  }

  const cls = await ctx.db.get(args.classId);
  if (cls === null) {
    throw new ConvexError("Selected class no longer exists.");
  }
  if (cls.sections.length > 0 && !cls.sections.includes(section)) {
    throw new ConvexError(
      `Section "${section}" is not a section of ${cls.name}. Sections: ${cls.sections.join(", ") || "none"}.`,
    );
  }

  const duplicate = await ctx.db
    .query("students")
    .withIndex("by_roll", (q) => q.eq("rollNumber", rollNumber))
    .first();
  if (duplicate !== null && duplicate._id !== excludeStudentId) {
    throw new ConvexError(
      `Roll number ${rollNumber} is already used by ${duplicate.name}.`,
    );
  }

  return { name, fatherName, rollNumber, section };
};

export const list = query({
  args: {
    classId: v.optional(v.id("classes")),
    section: v.optional(v.string()),
    status: v.optional(studentStatusValidator),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return [];

    const [students, classes] = await Promise.all([
      ctx.db.query("students").collect(),
      ctx.db.query("classes").collect(),
    ]);
    const classMap = new Map(classes.map((cls) => [cls._id, cls]));

    let rows = students;
    if (args.classId !== undefined) {
      rows = rows.filter((s) => s.classId === args.classId);
    }
    if (args.section !== undefined && args.section.trim() !== "") {
      const section = args.section.trim().toUpperCase();
      rows = rows.filter((s) => s.section === section);
    }
    if (args.status !== undefined) {
      rows = rows.filter((s) => s.status === args.status);
    }
    const search = args.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.fatherName.toLowerCase().includes(search) ||
          s.rollNumber.toLowerCase().includes(search),
      );
    }

    return rows
      .map((s) => ({
        ...s,
        className: classMap.get(s.classId)?.name ?? "—",
      }))
      .sort((a, b) => {
        const byClass = (a.className ?? "").localeCompare(b.className ?? "");
        if (byClass !== 0) return byClass;
        return a.rollNumber.localeCompare(b.rollNumber);
      })
      .slice(0, 1000);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    fatherName: v.string(),
    rollNumber: v.string(),
    classId: v.id("classes"),
    section: v.string(),
    admissionDate: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    phone: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    address: v.optional(v.string()),
    bloodGroup: v.optional(v.string()),
    previousSchool: v.optional(v.string()),
    previousClass: v.optional(v.string()),
    documentType: v.optional(v.string()),
    documentNumber: v.optional(v.string()),
    siblingId: v.optional(v.id("students")),
    notes: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStudentManager(ctx);
    const cleaned = await validateStudentInput(ctx, args);
    return await ctx.db.insert("students", {
      ...cleaned,
      classId: args.classId,
      photoUrl: args.photoUrl,
      admissionDate: args.admissionDate,
      birthDate: args.birthDate,
      phone: args.phone?.trim() || undefined,
      gender: args.gender,
      address: args.address?.trim() || undefined,
      bloodGroup: args.bloodGroup?.trim() || undefined,
      previousSchool: args.previousSchool?.trim() || undefined,
      previousClass: args.previousClass?.trim() || undefined,
      documentType: args.documentType?.trim() || undefined,
      documentNumber: args.documentNumber?.trim() || undefined,
      siblingId: args.siblingId,
      notes: args.notes?.trim() || undefined,
      status: "active",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("students"),
    name: v.string(),
    fatherName: v.string(),
    rollNumber: v.string(),
    classId: v.id("classes"),
    section: v.string(),
    admissionDate: v.optional(v.string()),
    birthDate: v.optional(v.string()),
    phone: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    address: v.optional(v.string()),
    bloodGroup: v.optional(v.string()),
    previousSchool: v.optional(v.string()),
    previousClass: v.optional(v.string()),
    documentType: v.optional(v.string()),
    documentNumber: v.optional(v.string()),
    siblingId: v.optional(v.id("students")),
    notes: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStudentManager(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Student not found.");
    }
    const cleaned = await validateStudentInput(ctx, args, args.id);
    await ctx.db.patch(args.id, {
      ...cleaned,
      classId: args.classId,
      admissionDate: args.admissionDate,
      birthDate: args.birthDate,
      phone: args.phone?.trim() || undefined,
      gender: args.gender,
      address: args.address?.trim() || undefined,
      bloodGroup: args.bloodGroup?.trim() || undefined,
      previousSchool: args.previousSchool?.trim() || undefined,
      previousClass: args.previousClass?.trim() || undefined,
      documentType: args.documentType?.trim() || undefined,
      documentNumber: args.documentNumber?.trim() || undefined,
      siblingId: args.siblingId,
      notes: args.notes?.trim() || undefined,
      photoUrl: args.photoUrl,
    });
  },
});

/** Quick update for just the photo URL. */
export const setPhoto = mutation({
  args: {
    id: v.id("students"),
    photoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStudentManager(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) throw new ConvexError("Student not found.");
    await ctx.db.patch(args.id, { photoUrl: args.photoUrl });
  },
});

/** Archive (set to "left") or re-activate a student. */
export const setStatus = mutation({
  args: {
    id: v.id("students"),
    status: studentStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireStudentManager(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Student not found.");
    }
    await ctx.db.patch(args.id, { status: args.status });
  },
});
