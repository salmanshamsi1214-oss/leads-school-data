import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isSchoolUser, requireStudentManager } from "./permissions";

const normalizeSections = (sections: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of sections) {
    const section = raw.trim().toUpperCase().replace(/\s+/g, "");
    if (section.length === 0) continue;
    if (!seen.has(section)) {
      seen.add(section);
      result.push(section);
    }
  }
  return result;
};

/**
 * Lists all classes ordered by their display order, with the number of
 * currently enrolled (active) students in each class.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) return [];
    const [classes, students] = await Promise.all([
      ctx.db.query("classes").collect(),
      ctx.db.query("students").collect(),
    ]);
    const counts = new Map<string, number>();
    for (const student of students) {
      if (student.status !== "active") continue;
      counts.set(student.classId, (counts.get(student.classId) ?? 0) + 1);
    }
    return classes
      .map((cls) => ({
        ...cls,
        studentCount: counts.get(cls._id) ?? 0,
      }))
      .sort((a, b) => a.order - b.order);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    sections: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStudentManager(ctx);
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError("Class name is required.");
    }
    const all = await ctx.db.query("classes").collect();
    const duplicate = all.find(
      (cls) => cls.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate !== undefined) {
      throw new ConvexError(`A class named "${name}" already exists.`);
    }
    const order =
      all.reduce((max, cls) => Math.max(max, cls.order), 0) + 1;
    return await ctx.db.insert("classes", {
      name,
      sections: normalizeSections(args.sections),
      order,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("classes"),
    name: v.string(),
    sections: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStudentManager(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Class not found.");
    }
    const name = args.name.trim();
    if (name.length === 0) {
      throw new ConvexError("Class name is required.");
    }
    const all = await ctx.db.query("classes").collect();
    const duplicate = all.find(
      (cls) =>
        cls.name.toLowerCase() === name.toLowerCase() && cls._id !== args.id,
    );
    if (duplicate !== undefined) {
      throw new ConvexError(`A class named "${name}" already exists.`);
    }
    await ctx.db.patch(args.id, {
      name,
      sections: normalizeSections(args.sections),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("classes") },
  handler: async (ctx, args) => {
    await requireStudentManager(ctx);
    const existing = await ctx.db.get(args.id);
    if (existing === null) {
      throw new ConvexError("Class not found.");
    }
    const enrolled = await ctx.db
      .query("students")
      .withIndex("by_class_section", (q) => q.eq("classId", args.id))
      .collect();
    if (enrolled.length > 0) {
      throw new ConvexError(
        `Cannot delete "${existing.name}": ${enrolled.length} student(s) are still enrolled in it. Move or remove them first.`,
      );
    }
    await ctx.db.delete(args.id);
  },
});
