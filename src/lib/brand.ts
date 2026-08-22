export const BRAND = {
  schoolName: "LEADS School System",
  campusName: "Zeenat Campus",
  shortName: "LEADS",
  tagline: "Attendance-first School Management",
  address: "Kangan Road, Near Jalbani Petrol Pump, Dera Ghazi Khan",
  phones: ["0332-6241440", "0330-9082020"],
  email: "info@leadsschool.edu.pk",
} as const;

export const fullSchoolName = `${BRAND.schoolName} — ${BRAND.campusName}`;
