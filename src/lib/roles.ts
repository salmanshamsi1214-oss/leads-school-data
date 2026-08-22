import { ROLES, type Role } from "@/convex/schema";

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.ADMIN]: "Admin",
  [ROLES.PRINCIPAL]: "Principal",
  [ROLES.VICE_PRINCIPAL]: "Vice Principal",
  [ROLES.ACCOUNTANT]: "Accountant",
  [ROLES.TEACHER]: "Teacher",
  [ROLES.RECEPTIONIST]: "Receptionist",
  [ROLES.LIBRARIAN]: "Librarian",
  [ROLES.PARENT]: "Parent",
  [ROLES.STUDENT]: "Student",
  [ROLES.USER]: "Pending approval",
};

export const ROLE_OPTIONS: { value: Role; label: string }[] = (
  Object.keys(ROLE_LABELS) as Role[]
).map((role) => ({ value: role, label: ROLE_LABELS[role] }));

/** Roles allowed into the school modules (staff incl. teachers). */
export const SCHOOL_ROLES: Role[] = [
  ROLES.ADMIN,
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
  ROLES.ACCOUNTANT,
  ROLES.TEACHER,
  ROLES.RECEPTIONIST,
  ROLES.LIBRARIAN,
];

/** Office staff: everyone except teachers/parents/students. */
export const OFFICE_ROLES: Role[] = [
  ROLES.ADMIN,
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
  ROLES.ACCOUNTANT,
  ROLES.RECEPTIONIST,
  ROLES.LIBRARIAN,
];

/** Roles allowed into fee management. */
export const FEE_MANAGER_ROLES: Role[] = [
  ROLES.ADMIN,
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
  ROLES.ACCOUNTANT,
];

export const formatRole = (role?: Role | null): string =>
  role ? ROLE_LABELS[role] ?? role : "Unassigned";
