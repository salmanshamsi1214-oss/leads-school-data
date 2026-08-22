import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ROLES, type Role } from "./schema";

/**
 * Returns the signed-in user document, or null when not authenticated.
 * Works from both queries and mutations.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get(userId);
}

/** True when the signed-in user has the school admin role. */
export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const user = await getCurrentUser(ctx);
  return user?.role === ROLES.ADMIN;
}

/**
 * Throws unless the signed-in user is a school admin.
 * Returns the user document on success.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) {
    throw new ConvexError("You must be signed in to do that.");
  }
  if (user.role !== ROLES.ADMIN) {
    throw new ConvexError("Admin access is required for this action.");
  }
  return user;
}

/** True when the signed-in user has one of the given roles. */
export async function hasRole(
  ctx: QueryCtx | MutationCtx,
  roles: readonly Role[],
): Promise<boolean> {
  const user = await getCurrentUser(ctx);
  return user !== null && user.role !== undefined && roles.includes(user.role);
}

/**
 * Throws unless the signed-in user has one of the given roles.
 * Returns the user document on success.
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  roles: readonly Role[],
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) {
    throw new ConvexError("You must be signed in to do that.");
  }
  if (user.role === undefined || !roles.includes(user.role)) {
    throw new ConvexError("You don't have permission to do that.");
  }
  return user;
}

// Role groups used across the modules.
export const SCHOOL_ROLES = [
  ROLES.ADMIN,
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
  ROLES.ACCOUNTANT,
  ROLES.TEACHER,
  ROLES.RECEPTIONIST,
  ROLES.LIBRARIAN,
] as const;

/** Office staff: everyone except teachers/parents/students. */
export const OFFICE_ROLES = [
  ROLES.ADMIN,
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
  ROLES.ACCOUNTANT,
  ROLES.RECEPTIONIST,
  ROLES.LIBRARIAN,
] as const;

/** Can create/edit student and class records (office + admissions desk). */
export const STUDENT_MANAGER_ROLES = [
  ROLES.ADMIN,
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
  ROLES.RECEPTIONIST,
] as const;

/** Can manage fee structures, record payments and run the due list. */
export const FEE_MANAGER_ROLES = [
  ROLES.ADMIN,
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
  ROLES.ACCOUNTANT,
] as const;

/** Can manage teacher records (hiring, profiles, status). */
export const TEACHER_MANAGER_ROLES = [
  ROLES.ADMIN,
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
] as const;

/** Read access to school data (all staff incl. teachers). */
export const isSchoolUser = (ctx: QueryCtx | MutationCtx) =>
  hasRole(ctx, SCHOOL_ROLES);

export const requireSchoolUser = (ctx: QueryCtx | MutationCtx) =>
  requireRole(ctx, SCHOOL_ROLES);

/** Office staff (any staff role except teacher). */
export const requireOfficeUser = (ctx: QueryCtx | MutationCtx) =>
  requireRole(ctx, OFFICE_ROLES);

export const requireStudentManager = (ctx: QueryCtx | MutationCtx) =>
  requireRole(ctx, STUDENT_MANAGER_ROLES);

export const requireFeeManager = (ctx: QueryCtx | MutationCtx) =>
  requireRole(ctx, FEE_MANAGER_ROLES);

export const requireTeacherManager = (ctx: QueryCtx | MutationCtx) =>
  requireRole(ctx, TEACHER_MANAGER_ROLES);
