import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { requireAdmin } from "./permissions";
import { ROLES, roleValidator } from "./schema";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/**
 * Bootstraps a role for the signed-in user:
 * - Guest (anonymous) accounts are granted admin immediately — the
 *   "Continue as Guest" button always opens the full system, no approval
 *   needed. This also upgrades older guest accounts that were created
 *   before this rule existed.
 * - Email accounts: the very first account in the system becomes the
 *   school admin, and every later account gets the plain "user" role
 *   until an admin promotes them.
 * Returns the assigned role. Safe to call repeatedly.
 */
export const bootstrapRole = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("You must be signed in.");
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      throw new ConvexError("User not found.");
    }
    if (user.isAnonymous) {
      if (user.role !== ROLES.ADMIN) {
        await ctx.db.patch(userId, { role: ROLES.ADMIN });
      }
      return ROLES.ADMIN;
    }
    if (user.role) {
      return user.role;
    }
    const existingAdmin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.ADMIN))
      .first();
    const role = existingAdmin === null ? ROLES.ADMIN : ROLES.USER;
    await ctx.db.patch(userId, { role });
    return role;
  },
});

/**
 * Admin recovery for lost setups. Promotes the signed-in user to admin only
 * when the current admin is an anonymous (guest) account with no email — i.e.
 * an admin that can no longer be signed back into. Requires the caller to
 * have a verified email, so a real person is claiming the system. The
 * unreachable anonymous admin is demoted to keep a single admin. Once an
 * email-bound admin exists this does nothing.
 */
export const recoverAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError("You must be signed in.");
    }
    const user = await ctx.db.get(userId);
    if (user === null) {
      throw new ConvexError("User not found.");
    }
    if (user.role === ROLES.ADMIN) {
      return user.role;
    }
    if (!user.email) {
      throw new ConvexError(
        "Sign in with your email address to recover admin access — guest accounts can't claim it.",
      );
    }
    const admin = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.ADMIN))
      .first();
    if (admin === null) {
      await ctx.db.patch(userId, { role: ROLES.ADMIN });
      return ROLES.ADMIN;
    }
    if (!admin.isAnonymous) {
      throw new ConvexError(
        "An admin with a verified email already exists. Ask that admin to assign your role on the Staff & Roles page.",
      );
    }
    // The existing admin is an unreachable guest session — take over, then
    // demote it so the system keeps exactly one admin.
    await ctx.db.patch(userId, { role: ROLES.ADMIN });
    await ctx.db.patch(admin._id, { role: ROLES.USER });
    return ROLES.ADMIN;
  },
});

/**
 * All user accounts with their roles — used by the Staff & Roles page.
 * Admin only.
 */
export const listAccounts = query({
  args: {},
  handler: async (ctx) => {
    if (!(await requireAdmin(ctx))) return [];
    const users = await ctx.db.query("users").collect();
    return users
      .map((user) => ({
        _id: user._id,
        name: user.name ?? "",
        email: user.email ?? "",
        role: user.role ?? ROLES.USER,
        isAnonymous: user.isAnonymous ?? false,
        emailVerificationTime: user.emailVerificationTime ?? undefined,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  },
});

/**
 * Assign a school role to a user account. Admin only. The admin's own role
 * cannot be changed to prevent locking the system out of administration.
 */
export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (args.userId === admin._id && args.role !== ROLES.ADMIN) {
      throw new ConvexError("You cannot remove your own admin access.");
    }
    const target = await ctx.db.get(args.userId);
    if (target === null) {
      throw new ConvexError("Account not found.");
    }
    await ctx.db.patch(args.userId, { role: args.role });
    return args.role;
  },
});
