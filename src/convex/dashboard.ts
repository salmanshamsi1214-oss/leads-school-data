import { v } from "convex/values";
import { query } from "./_generated/server";
import { isSchoolUser } from "./permissions";

const isoDate = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

const EMPTY = {
  totalStudents: 0,
  activeStudents: 0,
  classCount: 0,
  today: { present: 0, absent: 0, late: 0, leave: 0, marked: 0, presentRate: 0 },
  perClass: [],
  recentAbsents: [],
  trend: [],
  teacherCount: 0,
  teacherToday: { present: 0, total: 0 },
  feeMonth: { collected: 0, expected: 0, outstanding: 0, dueCount: 0 },
  birthdays: [],
  birthdaysCount: 0,
  monthBirthdays: [],
  monthBirthdaysCount: 0,
  teacherDiaryPending: 0,
  diariesToday: 0,
};

/** Monday (YYYY-MM-DD) of the week containing the given ISO date. */
const mondayOf = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  return isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff)));
};

/**
 * Everything the dashboard needs in one reactive query:
 * student totals, today's attendance, per-class present rates, the list of
 * students absent or late today, a 14-day attendance trend, today's teacher
 * attendance, and this month's fee collection summary.
 */
export const overview = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    if (!(await isSchoolUser(ctx))) return EMPTY;

    const [students, classes, records, teachers, teacherRecords, feeStructures, feePayments, feeAssignments, dailyDiary, weeklyDiary] =
      await Promise.all([
        ctx.db.query("students").collect(),
        ctx.db.query("classes").collect(),
        ctx.db.query("attendance").collect(),
        ctx.db.query("teachers").collect(),
        ctx.db.query("teacherAttendance").collect(),
        ctx.db.query("feeStructures").collect(),
        ctx.db.query("feePayments").collect(),
        ctx.db.query("feeAssignments").collect(),
        ctx.db.query("dailyDiary").collect(),
        ctx.db.query("weeklyDiary").collect(),
      ]);

    const classMap = new Map(classes.map((cls) => [cls._id, cls]));
    const activeStudents = students.filter((s) => s.status === "active");
    const activeIds = new Set(activeStudents.map((s) => s._id));

    const recordsByDate = new Map<string, typeof records>();
    for (const record of records) {
      if (!activeIds.has(record.studentId)) continue;
      const list = recordsByDate.get(record.date) ?? [];
      list.push(record);
      recordsByDate.set(record.date, list);
    }

    // Today's summary
    const todayRecords = recordsByDate.get(args.date) ?? [];
    const count = (status: string) =>
      todayRecords.filter((r) => r.status === status).length;
    const present = count("present");
    const absent = count("absent");
    const late = count("late");
    const leave = count("leave");
    const marked = todayRecords.length;
    const presentRate =
      activeStudents.length === 0
        ? 0
        : Math.round((present / activeStudents.length) * 1000) / 10;

    // Per-class present rate for today
    const perClass = classes
      .map((cls) => {
        const members = activeStudents.filter((s) => s.classId === cls._id);
        const classToday = todayRecords.filter((r) =>
          members.some((m) => m._id === r.studentId),
        );
        const classPresent = classToday.filter((r) => r.status === "present").length;
        return {
          classId: cls._id,
          name: cls.name,
          total: members.length,
          present: classPresent,
          rate:
            members.length === 0
              ? 0
              : Math.round((classPresent / members.length) * 1000) / 10,
        };
      })
      .filter((c) => c.total > 0)
      .sort((a, b) => b.rate - a.rate);

    // Students absent or late today (name + class + section)
    const studentMap = new Map(students.map((s) => [s._id, s]));
    const recentAbsents = todayRecords
      .filter((r) => r.status === "absent" || r.status === "late")
      .map((r) => {
        const student = studentMap.get(r.studentId);
        const cls = student ? classMap.get(student.classId) : undefined;
        return {
          studentId: r.studentId,
          name: student?.name ?? "Unknown",
          rollNumber: student?.rollNumber ?? "",
          className: cls?.name ?? "—",
          section: student?.section ?? "",
          status: r.status,
        };
      })
      .sort((a, b) => a.className.localeCompare(b.className))
      .slice(0, 12);

    // 14-day trend (including today)
    const today = new Date();
    const trend: {
      date: string;
      present: number;
      marked: number;
      rate: number;
    }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i),
      );
      const date = isoDate(day);
      const dayRecords = recordsByDate.get(date) ?? [];
      const dayPresent = dayRecords.filter((r) => r.status === "present").length;
      trend.push({
        date,
        present: dayPresent,
        marked: dayRecords.length,
        rate:
          dayRecords.length === 0
            ? 0
            : Math.round((dayPresent / dayRecords.length) * 1000) / 10,
      });
    }

    // Teacher attendance today
    const activeTeachers = teachers.filter((t) => t.status === "active");
    const teacherTodayRecords = teacherRecords.filter((r) => r.date === args.date);
    const teacherPresent = teacherTodayRecords.filter(
      (r) => r.status === "present",
    ).length;

    // Fee collection for the current month (from the dashboard date).
    const month = args.date.slice(0, 7);
    const monthlyByClass = new Map<string, number>();
    for (const structure of feeStructures) {
      if (structure.period !== "monthly") continue;
      monthlyByClass.set(
        structure.classId,
        (monthlyByClass.get(structure.classId) ?? 0) + structure.amount,
      );
    }
    const adjustmentByStudent = new Map<string, number>();
    for (const assignment of feeAssignments) {
      adjustmentByStudent.set(
        assignment.studentId,
        (adjustmentByStudent.get(assignment.studentId) ?? 0) + assignment.amount,
      );
    }
    const feeStudents = activeStudents.filter((s) =>
      ((monthlyByClass.get(s.classId) ?? 0) + (adjustmentByStudent.get(s._id) ?? 0)) > 0,
    );
    const expected = feeStudents.reduce(
      (sum, s) =>
        sum +
        Math.max(
          0,
          (monthlyByClass.get(s.classId) ?? 0) + (adjustmentByStudent.get(s._id) ?? 0),
        ),
      0,
    );
    const monthPayments = feePayments.filter((p) => p.period === month);
    const collected = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    const paidIds = new Set(monthPayments.map((p) => p.studentId));
    const feeMonth = {
      collected: Math.round(collected * 100) / 100,
      expected: Math.round(expected * 100) / 100,
      outstanding: Math.round((expected - collected) * 100) / 100,
      dueCount: feeStudents.filter((s) => !paidIds.has(s._id)).length,
    };

    // Birthdays in the next 7 days (including today), from the dashboard
    // date — students and teachers, so the office sees the whole school.
    const todayMs = new Date(`${args.date}T00:00:00Z`).getTime();
    const daysUntilFor = (birthDate: string): number => {
      const [, bMonth, bDay] = birthDate.split("-").map(Number);
      const year = Number(args.date.slice(0, 4));
      let next = new Date(Date.UTC(year, bMonth - 1, bDay));
      if (next.getTime() < todayMs) {
        next = new Date(Date.UTC(year + 1, bMonth - 1, bDay));
      }
      return Math.round((next.getTime() - todayMs) / 86400000);
    };
    const studentBirthdays = activeStudents
      .filter((s) => s.birthDate)
      .map((s) => {
        const cls = classMap.get(s.classId);
        return {
          studentId: s._id,
          kind: "student" as const,
          name: s.name,
          subtitle: `${cls?.name ?? "—"} · Section ${s.section}`,
          className: cls?.name ?? "—",
          section: s.section,
          rollNumber: s.rollNumber,
          phone: s.phone ?? "",
          birthDate: s.birthDate!,
          daysUntil: daysUntilFor(s.birthDate!),
        };
      });
    const teacherBirthdays = activeTeachers
      .filter((t) => t.birthDate)
      .map((t) => ({
        studentId: t._id,
        kind: "teacher" as const,
        name: t.name,
        subtitle: `Staff${t.subject ? ` · ${t.subject}` : ""}`,
        className: "Staff",
        section: "",
        rollNumber: "",
        phone: t.phone ?? "",
        birthDate: t.birthDate!,
        daysUntil: daysUntilFor(t.birthDate!),
      }));
    const birthdays = [...studentBirthdays, ...teacherBirthdays]
      .filter((b) => b.daysUntil >= 0 && b.daysUntil <= 6)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    // All birthdays this calendar month (including past dates)
    const currentMonth = Number(args.date.slice(5, 7)); // 1-12
    const monthBirthdays = [...studentBirthdays, ...teacherBirthdays]
      .filter((b) => {
        const birthDate = b.kind === "student"
          ? activeStudents.find((s) => s._id === b.studentId)?.birthDate
          : activeTeachers.find((t) => t._id === b.studentId)?.birthDate;
        if (!birthDate) return false;
        const [, bMonth] = birthDate.split("-").map(Number);
        return bMonth === currentMonth;
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    // Teachers with a class assignment who haven't submitted a weekly diary
    // for the current week.
    const weekStart = mondayOf(args.date);
    const submittedClassIds = new Set(
      weeklyDiary.filter((w) => w.weekStart === weekStart).map((w) => w.classId),
    );
    const teacherDiaryPending = activeTeachers.filter(
      (t) => t.classId !== undefined && !submittedClassIds.has(t.classId),
    ).length;

    const diariesToday = dailyDiary.filter((d) => d.date === args.date).length;

    return {
      totalStudents: students.length,
      activeStudents: activeStudents.length,
      classCount: classes.length,
      today: { present, absent, late, leave, marked, presentRate },
      perClass,
      recentAbsents,
      trend,
      teacherCount: activeTeachers.length,
      teacherToday: { present: teacherPresent, total: activeTeachers.length },
      feeMonth,
      birthdays,
      birthdaysCount: birthdays.length,
      monthBirthdays,
      monthBirthdaysCount: monthBirthdays.length,
      teacherDiaryPending,
      diariesToday,
    };
  },
});
