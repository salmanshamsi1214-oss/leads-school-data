/**
 * School-specific shared utility functions.
 * Used across Dashboard, Birthdays, and other pages.
 */

/** wa.me link for a Pakistani phone number, if it can be parsed. */
export function whatsappLink(phone: string, message: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  if (!digits.startsWith("92")) digits = `92${digits}`;
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Extract initials from a name: "Ali Raza" → "AR" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Standard birthday greeting message */
export const BIRTHDAY_MESSAGE =
  "Happy Birthday! 🎂 Wishing you a wonderful year ahead — Leads School System, Zeenat Campus";

/** Format class name with section: "1-A" */
export function classSectionLabel(className: string, section: string): string {
  return section ? `${className} — Section ${section}` : className;
}
