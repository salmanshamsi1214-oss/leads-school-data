import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isSchoolUser, requireOfficeUser } from "./permissions";

export const DEFAULT_LATE_GATE_TIME = "08:00";

const TIME_RE = /^\d{2}:\d{2}$/;

/** Validates a 24-hour "HH:MM" time and returns it trimmed, or throws. */
const validateTime = (time: string): string => {
  const value = time.trim();
  if (!TIME_RE.test(value)) {
    throw new ConvexError("Gate time must be in HH:MM format (e.g. 08:00).");
  }
  const [hour, minute] = value.split(":").map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new ConvexError("Gate time must be a valid 24-hour time.");
  }
  return value;
};

const getSetting = async (ctx: QueryCtx | MutationCtx, key: string) => {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  return row?.value;
};

/** School settings; currently the late-arrival gate time. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isSchoolUser(ctx))) {
      return { lateGateTime: DEFAULT_LATE_GATE_TIME };
    }
    const value = await getSetting(ctx, "lateGateTime");
    return { lateGateTime: value ?? DEFAULT_LATE_GATE_TIME };
  },
});

/** Changes the time after which arrivals count as late. */
export const setLateGateTime = mutation({
  args: { time: v.string() },
  handler: async (ctx, args) => {
    await requireOfficeUser(ctx);
    const value = validateTime(args.time);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "lateGateTime"))
      .first();
    if (existing !== null) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("settings", { key: "lateGateTime", value });
    }
  },
});
