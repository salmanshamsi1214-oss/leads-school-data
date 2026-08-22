import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// School roles. Guests are bootstrapped as admin immediately; for email
// accounts the first signed-in account becomes admin, and an admin promotes
// the rest via the Staff & Roles page.
export const ROLES = {
  ADMIN: "admin",
  PRINCIPAL: "principal",
  VICE_PRINCIPAL: "vice_principal",
  ACCOUNTANT: "accountant",
  TEACHER: "teacher",
  RECEPTIONIST: "receptionist",
  LIBRARIAN: "librarian",
  PARENT: "parent",
  STUDENT: "student",
  USER: "user",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.PRINCIPAL),
  v.literal(ROLES.VICE_PRINCIPAL),
  v.literal(ROLES.ACCOUNTANT),
  v.literal(ROLES.TEACHER),
  v.literal(ROLES.RECEPTIONIST),
  v.literal(ROLES.LIBRARIAN),
  v.literal(ROLES.PARENT),
  v.literal(ROLES.STUDENT),
  v.literal(ROLES.USER),
);
export type Role = Infer<typeof roleValidator>;

/** Fee payment methods accepted by the office. */
export const FEE_METHODS = ["cash", "bank", "easypaisa", "jazzcash", "other"] as const;
export const feeMethodValidator = v.union(
  v.literal("cash"),
  v.literal("bank"),
  v.literal("easypaisa"),
  v.literal("jazzcash"),
  v.literal("other"),
);
export type FeeMethod = Infer<typeof feeMethodValidator>;

/** Fee structure period — monthly fees drive the monthly due list. */
export const FEE_PERIODS = ["monthly", "annual", "admission"] as const;
export const feePeriodValidator = v.union(
  v.literal("monthly"),
  v.literal("annual"),
  v.literal("admission"),
);
export type FeePeriod = Infer<typeof feePeriodValidator>;

/** Attendance statuses used across the school. */
export const ATTENDANCE_STATUSES = ["present", "absent", "late", "leave"] as const;
export const attendanceStatusValidator = v.union(
  v.literal("present"),
  v.literal("absent"),
  v.literal("late"),
  v.literal("leave"),
);
export type AttendanceStatus = Infer<typeof attendanceStatusValidator>;

/** Student enrolment status. */
export const STUDENT_STATUSES = ["active", "left"] as const;
export const studentStatusValidator = v.union(
  v.literal("active"),
  v.literal("left"),
);
export type StudentStatus = Infer<typeof studentStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // School classes, e.g. "Nursery" ... "Matric", each with sections such as A/B/C.
    classes: defineTable({
      name: v.string(),
      sections: v.array(v.string()),
      order: v.number(),
    }).index("by_name", ["name"]),

    // Students enrolled at the school.
    students: defineTable({
      name: v.string(),
      fatherName: v.string(),
      rollNumber: v.string(),
      classId: v.id("classes"),
      section: v.string(),
      status: studentStatusValidator,
      admissionDate: v.optional(v.string()), // YYYY-MM-DD
      birthDate: v.optional(v.string()), // YYYY-MM-DD, drives the birthdays widget
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      photoUrl: v.optional(v.string()),
      gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
      bloodGroup: v.optional(v.string()),
      previousSchool: v.optional(v.string()),
      previousClass: v.optional(v.string()),
      documentType: v.optional(v.string()),
      documentNumber: v.optional(v.string()),
      siblingId: v.optional(v.id("students")),
      notes: v.optional(v.string()),
      leavingDate: v.optional(v.string()),
      leavingReason: v.optional(v.string()),
    })
      .index("by_class_section", ["classId", "section"])
      .index("by_roll", ["rollNumber"]),

    // One record per student per day. Uniqueness of (studentId, date) is
    // enforced in the mutation via an upsert. arrivalTime (HH:MM, 24h) is
    // captured for late arrivals so the Late Comers page can show how many
    // minutes after the gate a student arrived.
    attendance: defineTable({
      studentId: v.id("students"),
      date: v.string(), // YYYY-MM-DD
      status: attendanceStatusValidator,
      arrivalTime: v.optional(v.string()), // HH:MM, 24h
      remarks: v.optional(v.string()),
      markedBy: v.id("users"),
    })
      .index("by_date", ["date"])
      .index("by_student_date", ["studentId", "date"]),

    // One row per parent WhatsApp/SMS alert attempted for a student on a
    // date. Written by the alert action; dedupes repeated attendance saves
    // so parents are never pinged twice for the same day.
    attendanceAlerts: defineTable({
      studentId: v.id("students"),
      date: v.string(), // YYYY-MM-DD
      status: attendanceStatusValidator,
      remarks: v.string(),
      channel: v.string(), // "whatsapp" | "sms"
      state: v.union(v.literal("sending"), v.literal("sent"), v.literal("failed")),
      error: v.optional(v.string()),
      sentAt: v.optional(v.number()),
    })
      .index("by_date", ["date"])
      .index("by_student_date", ["studentId", "date"]),

    // Teaching staff records.
    teachers: defineTable({
      name: v.string(),
      phone: v.optional(v.string()),
      cnic: v.optional(v.string()),
      email: v.optional(v.string()),
      qualification: v.optional(v.string()),
      subject: v.optional(v.string()),
      designation: v.optional(v.string()),
      classId: v.optional(v.id("classes")), // class-teacher assignment
      joiningDate: v.optional(v.string()), // YYYY-MM-DD
      birthDate: v.optional(v.string()), // YYYY-MM-DD, drives the birthdays widget
      salary: v.optional(v.number()),
      status: v.union(v.literal("active"), v.literal("left")),
    }).index("by_name", ["name"]),

    // One record per teacher per day, upserted like student attendance.
    teacherAttendance: defineTable({
      teacherId: v.id("teachers"),
      date: v.string(), // YYYY-MM-DD
      status: attendanceStatusValidator,
      markedBy: v.id("users"),
    })
      .index("by_date", ["date"])
      .index("by_teacher_date", ["teacherId", "date"]),

    // Fee structures define what each class owes (monthly tuition, etc.).
    feeStructures: defineTable({
      classId: v.id("classes"),
      label: v.string(),
      amount: v.number(),
      period: feePeriodValidator,
    }).index("by_class", ["classId"]),

    // One row per fee payment received, with a printed receipt number.
    feePayments: defineTable({
      studentId: v.id("students"),
      period: v.string(), // YYYY-MM the payment covers
      amount: v.number(),
      method: feeMethodValidator,
      date: v.string(), // YYYY-MM-DD received
      receiptNo: v.string(),
      remarks: v.optional(v.string()),
      receivedBy: v.id("users"),
    })
      .index("by_student", ["studentId"])
      .index("by_period", ["period"])
      .index("by_receipt", ["receiptNo"]),

    // Per-student fee adjustments applied on top of the class monthly
    // structures. Negative amount = concession/discount, positive = extra
    // charge (e.g. transport). "Fee Assignment" module.
    feeAssignments: defineTable({
      studentId: v.id("students"),
      label: v.string(),
      amount: v.number(),
    }).index("by_student", ["studentId"]),

    // Daily diary — one entry per class/section/date, upserted on save.
    // Covers what was taught and homework given.
    dailyDiary: defineTable({
      classId: v.id("classes"),
      section: v.string(),
      date: v.string(), // YYYY-MM-DD
      summary: v.string(), // topics covered
      homework: v.optional(v.string()),
      createdBy: v.id("users"),
      updatedAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_class_section_date", ["classId", "section", "date"]),

    // Weekly diary — one entry per class/section/week, upserted on weekStart.
    // The main content is per-subject work (entries); summary/nextWeek are
    // optional teacher notes.
    weeklyDiary: defineTable({
      classId: v.id("classes"),
      section: v.string(),
      weekStart: v.string(), // YYYY-MM-DD (Monday)
      weekEnd: v.string(), // YYYY-MM-DD (Sunday)
      entries: v.optional(
        v.array(v.object({ subject: v.string(), work: v.string() })),
      ),
      summary: v.optional(v.string()), // optional notes for the week
      nextWeek: v.optional(v.string()), // plan for the following week
      createdBy: v.id("users"),
      updatedAt: v.number(),
    })
      .index("by_week", ["weekStart"])
      .index("by_class_section_week", ["classId", "section", "weekStart"]),

    // Key-value school settings. Currently used for the late-arrival gate
    // time (key "lateGateTime", value "HH:MM", default "08:00").
    settings: defineTable({
      key: v.string(),
      value: v.string(),
    }).index("by_key", ["key"]),

    // Bulk WhatsApp/SMS messages sent by the office (notices, fee reminders,
    // event announcements). One row per send batch; per-recipient outcomes
    // live in messageRecipients. Sending runs in the background via the
    // scheduler, so the office can send to a whole class without waiting.
    messages: defineTable({
      body: v.string(),
      channel: v.union(v.literal("whatsapp"), v.literal("sms")),
      target: v.string(), // human-readable audience, e.g. "All parents · 42 students"
      state: v.union(
        v.literal("sending"),
        v.literal("sent"),
        v.literal("partial"),
        v.literal("failed"),
      ),
      total: v.number(), // recipients with a valid phone number
      sentCount: v.number(),
      failedCount: v.number(),
      noPhoneCount: v.number(), // students in scope without a usable phone
      error: v.optional(v.string()),
      createdBy: v.id("users"),
    }),

    // One row per student targeted by a message, with the send outcome.
    messageRecipients: defineTable({
      messageId: v.id("messages"),
      studentId: v.id("students"),
      name: v.string(),
      rollNumber: v.string(),
      className: v.string(),
      section: v.string(),
      phone: v.string(), // normalized E.164 when sendable
      state: v.union(
        v.literal("sending"),
        v.literal("sent"),
        v.literal("failed"),
        v.literal("no_phone"),
      ),
      error: v.optional(v.string()),
    }).index("by_message", ["messageId"]),

    // Notice board — circulars posted by the office, visible to all staff.
    notices: defineTable({
      title: v.string(),
      body: v.string(),
      category: v.union(
        v.literal("general"),
        v.literal("exam"),
        v.literal("event"),
        v.literal("fee"),
        v.literal("holiday"),
        v.literal("emergency"),
      ),
      pinned: v.boolean(),
      publishDate: v.string(), // YYYY-MM-DD
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_date", ["publishDate"]),

    // Exams — one row per exam/test.
    exams: defineTable({
      title: v.string(),
      type: v.union(
        v.literal("monthly"),
        v.literal("midterm"),
        v.literal("final"),
        v.literal("weekly"),
        v.literal("other"),
      ),
      classId: v.id("classes"),
      section: v.string(),
      date: v.string(), // YYYY-MM-DD
      totalMarks: v.number(),
      subjects: v.array(
        v.object({ name: v.string(), maxMarks: v.number() }),
      ),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_class", ["classId"])
      .index("by_class_section", ["classId", "section"]),

    // Student exam results — one row per student per exam.
    examResults: defineTable({
      examId: v.id("exams"),
      studentId: v.id("students"),
      marks: v.array(
        v.object({
          subject: v.string(),
          obtained: v.number(),
          maxMarks: v.number(),
          remarks: v.optional(v.string()),
        }),
      ),
      totalObtained: v.number(),
      percentage: v.number(), // 0-100
      grade: v.string(), // A+, A, B+, B, C, D, F
      remarks: v.optional(v.string()),
      enteredBy: v.id("users"),
      enteredAt: v.number(),
    })
      .index("by_exam", ["examId"])
      .index("by_student", ["studentId"])
      .index("by_exam_student", ["examId", "studentId"]),

    // ========== ADMISSION INQUIRIES ==========
    inquiries: defineTable({
      studentName: v.string(),
      fatherName: v.optional(v.string()),
      phone: v.string(),
      classInterested: v.optional(v.string()),
      source: v.union(
        v.literal("walk_in"),
        v.literal("phone"),
        v.literal("whatsapp"),
        v.literal("referral"),
        v.literal("social_media"),
        v.literal("other"),
      ),
      status: v.union(
        v.literal("new"),
        v.literal("contacted"),
        v.literal("follow_up"),
        v.literal("enrolled"),
        v.literal("closed"),
      ),
      nextFollowUp: v.optional(v.string()), // YYYY-MM-DD
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_status", ["status"]),

    // ========== NOTEBOOK CHECKS ==========
    notebookChecks: defineTable({
      studentId: v.id("students"),
      classId: v.id("classes"),
      section: v.string(),
      subject: v.string(),
      date: v.string(), // YYYY-MM-DD
      pagesExpected: v.number(),
      pagesCompleted: v.number(),
      status: v.union(
        v.literal("complete"),
        v.literal("incomplete"),
        v.literal("not_brought"),
      ),
      remarks: v.optional(v.string()),
      checkedBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_student_date", ["studentId", "date"])
      .index("by_class_section_date", ["classId", "section", "date"]),

    // ========== DAILY TESTS ==========
    dailyTests: defineTable({
      classId: v.id("classes"),
      section: v.string(),
      subject: v.string(),
      title: v.optional(v.string()),
      date: v.string(), // YYYY-MM-DD
      totalMarks: v.number(),
      createdBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_class_section", ["classId", "section"]),

    dailyTestMarks: defineTable({
      testId: v.id("dailyTests"),
      studentId: v.id("students"),
      obtained: v.number(),
      remarks: v.optional(v.string()),
    })
      .index("by_test", ["testId"])
      .index("by_student", ["studentId"])
      .index("by_test_student", ["testId", "studentId"]),

    // ========== WEEKLY TESTS ==========
    weeklyTests: defineTable({
      classId: v.id("classes"),
      section: v.string(),
      subject: v.string(),
      title: v.optional(v.string()),
      date: v.string(), // YYYY-MM-DD
      totalMarks: v.number(),
      createdBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_class_section", ["classId", "section"]),

    weeklyTestMarks: defineTable({
      testId: v.id("weeklyTests"),
      studentId: v.id("students"),
      obtained: v.number(),
      remarks: v.optional(v.string()),
    })
      .index("by_test", ["testId"])
      .index("by_student", ["studentId"])
      .index("by_test_student", ["testId", "studentId"]),

    // ========== TIMETABLE ==========
    timetable: defineTable({
      classId: v.id("classes"),
      section: v.string(),
      day: v.number(), // 0=Monday … 6=Sunday
      period: v.number(), // 1, 2, 3 …
      subject: v.string(),
      teacherId: v.optional(v.id("teachers")),
      startTime: v.string(), // HH:MM
      endTime: v.string(), // HH:MM
      createdBy: v.id("users"),
      updatedAt: v.number(),
    })
      .index("by_class_section", ["classId", "section"])
      .index("by_class_section_day", ["classId", "section", "day"]),

    // ========== LESSON PLANS ==========
    lessonPlans: defineTable({
      classId: v.id("classes"),
      section: v.string(),
      subject: v.string(),
      topic: v.string(),
      objectives: v.string(),
      activities: v.optional(v.string()),
      resources: v.optional(v.string()),
      date: v.string(), // YYYY-MM-DD
      periodNo: v.optional(v.number()), // 1, 2, 3...
      lessonChapter: v.optional(v.string()),
      previousKnowledge: v.optional(v.string()),
      introduction: v.optional(v.string()),
      teachingMethod: v.optional(v.string()),
      explanation: v.optional(v.string()),
      classActivity: v.optional(v.string()),
      groupActivity: v.optional(v.string()),
      studentPractice: v.optional(v.string()),
      questionAnswer: v.optional(v.string()),
      assessmentMethod: v.optional(v.string()),
      homework: v.optional(v.string()),
      differentiatedLearning: v.optional(v.string()),
      extensionActivity: v.optional(v.string()),
      timingStarter: v.optional(v.number()), // minutes
      timingPresentation: v.optional(v.number()),
      timingPractice: v.optional(v.number()),
      timingAssessment: v.optional(v.number()),
      timingHomework: v.optional(v.number()),
      reflectionWhatWentWell: v.optional(v.string()),
      reflectionUnderstanding: v.optional(v.string()),
      reflectionNeedSupport: v.optional(v.string()),
      reflectionDifficulties: v.optional(v.string()),
      reflectionFollowUp: v.optional(v.string()),
      lessonCompleted: v.optional(v.boolean()),
      coordinatorRemarks: v.optional(v.string()),
      principalRemarks: v.optional(v.string()),
      status: v.union(
        v.literal("planned"),
        v.literal("taught"),
        v.literal("revised"),
      ),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_class_section", ["classId", "section"])
      .index("by_teacher", ["createdBy"]),

    // ========== SYLLABUS TRACKING ==========
    syllabus: defineTable({
      classId: v.id("classes"),
      section: v.string(),
      subject: v.string(),
      term: v.union(
        v.literal("1st_term"),
        v.literal("2nd_term"),
        v.literal("final_term"),
      ),
      bookName: v.optional(v.string()),
      chapterNo: v.string(),
      chapterName: v.string(),
      topics: v.string(),
      subTopics: v.optional(v.string()),
      pagesFrom: v.optional(v.number()),
      pagesTo: v.optional(v.number()),
      syllabusType: v.union(
        v.literal("written"),
        v.literal("oral"),
        v.literal("practical"),
      ),
      learningObjectives: v.optional(v.string()),
      writtenWork: v.optional(v.string()),
      oralWork: v.optional(v.string()),
      practicalWork: v.optional(v.string()),
      homework: v.optional(v.string()),
      classActivity: v.optional(v.string()),
      assessment: v.optional(v.string()),
      teachingAids: v.optional(v.string()),
      totalLessons: v.number(),
      completedLessons: v.number(),
      startDate: v.optional(v.string()),
      expectedEndDate: v.optional(v.string()),
      actualEndDate: v.optional(v.string()),
      status: v.union(
        v.literal("not_started"),
        v.literal("in_progress"),
        v.literal("completed"),
      ),
      revisionRequired: v.optional(v.boolean()),
      revisionCompleted: v.optional(v.boolean()),
      testTaken: v.optional(v.boolean()),
      weakAreas: v.optional(v.string()),
      additionalPractice: v.optional(v.string()),
      teacherRemarks: v.optional(v.string()),
      coordinatorRemarks: v.optional(v.string()),
      principalRemarks: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_class_subject", ["classId", "subject"])
      .index("by_term", ["term"])
      .index("by_status", ["status"]),

    // ========== ROBOTICS LAB ==========
    robotProjects: defineTable({
      studentId: v.id("students"),
      classId: v.id("classes"),
      section: v.string(),
      projectName: v.string(),
      description: v.optional(v.string()),
      status: v.union(
        v.literal("planning"),
        v.literal("building"),
        v.literal("testing"),
        v.literal("completed"),
        v.literal("presented"),
      ),
      startDate: v.optional(v.string()), // YYYY-MM-DD
      completionDate: v.optional(v.string()),
      grade: v.optional(v.string()),
      remarks: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_student", ["studentId"])
      .index("by_class_section", ["classId", "section"])
      .index("by_status", ["status"]),

    // ========== ACTIVITY SUBMISSIONS ==========
    activitySubmissions: defineTable({
      studentId: v.id("students"),
      classId: v.id("classes"),
      section: v.string(),
      activityTitle: v.string(),
      subject: v.optional(v.string()),
      description: v.optional(v.string()),
      submissionType: v.union(
        v.literal("written"),
        v.literal("practical"),
        v.literal("project"),
        v.literal("presentation"),
        v.literal("other"),
      ),
      status: v.union(
        v.literal("pending"),
        v.literal("submitted"),
        v.literal("reviewed"),
        v.literal("returned"),
      ),
      marksObtained: v.optional(v.number()),
      totalMarks: v.optional(v.number()),
      feedback: v.optional(v.string()),
      submissionDate: v.optional(v.string()), // YYYY-MM-DD
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_student", ["studentId"])
      .index("by_class_section", ["classId", "section"])
      .index("by_status", ["status"]),

    // ========== FEE SLIPS / CHALLANS ==========
    feeSlips: defineTable({
      studentId: v.id("students"),
      classId: v.id("classes"),
      section: v.string(),
      period: v.string(), // YYYY-MM
      type: v.union(
        v.literal("slip"),
        v.literal("challan"),
        v.literal("reminder"),
      ),
      totalAmount: v.number(),
      paidAmount: v.number(),
      balance: v.number(),
      dueDate: v.optional(v.string()), // YYYY-MM-DD, for challans
      status: v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("paid"),
        v.literal("overdue"),
      ),
      sentChannel: v.optional(v.union(v.literal("whatsapp"), v.literal("sms"), v.literal("printed"))),
      sentAt: v.optional(v.number()),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_student", ["studentId"])
      .index("by_period", ["period"])
      .index("by_status", ["status"]),

    // ========== ACTIVITIES (Extracurricular Calendar) ==========
    activities: defineTable({
      title: v.string(),
      description: v.optional(v.string()),
      type: v.union(
        v.literal("sports"),
        v.literal("cultural"),
        v.literal("academic"),
        v.literal("competition"),
        v.literal("workshop"),
        v.literal("field_trip"),
        v.literal("assembly"),
        v.literal("other"),
      ),
      date: v.string(), // YYYY-MM-DD
      endDate: v.optional(v.string()), // for multi-day events
      classIds: v.optional(v.array(v.id("classes"))), // specific classes, empty = all
      location: v.optional(v.string()),
      organizer: v.optional(v.string()),
      status: v.union(
        v.literal("upcoming"),
        v.literal("ongoing"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_status", ["status"]),

    // Participation records for activities
    activityParticipants: defineTable({
      activityId: v.id("activities"),
      studentId: v.id("students"),
      role: v.optional(v.string()), // e.g. "participant", "winner", "organizer"
      result: v.optional(v.string()), // e.g. "1st Place", "Honourable Mention"
      remarks: v.optional(v.string()),
    })
      .index("by_activity", ["activityId"])
      .index("by_student", ["studentId"]),

    // ========== PAYROLL (Salary Slips) ==========
    payrollRecords: defineTable({
      teacherId: v.id("teachers"),
      month: v.string(), // YYYY-MM
      baseSalary: v.number(),
      allowance: v.optional(v.number()),
      deduction: v.optional(v.number()),
      bonus: v.optional(v.number()),
      netPay: v.number(),
      status: v.union(
        v.literal("draft"),
        v.literal("approved"),
        v.literal("paid"),
      ),
      paidMethod: v.optional(
        v.union(
          v.literal("cash"),
          v.literal("bank"),
          v.literal("easypaisa"),
          v.literal("jazzcash"),
        ),
      ),
      paidDate: v.optional(v.string()), // YYYY-MM-DD
      remarks: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_teacher", ["teacherId"])
      .index("by_month", ["month"])
      .index("by_teacher_month", ["teacherId", "month"]),

    // ========== EXPENSES ==========
    expenses: defineTable({
      title: v.string(),
      amount: v.number(),
      category: v.union(
        v.literal("salary"),
        v.literal("utilities"),
        v.literal("maintenance"),
        v.literal("supplies"),
        v.literal("transport"),
        v.literal("events"),
        v.literal("technology"),
        v.literal("other"),
      ),
      date: v.string(), // YYYY-MM-DD
      paidMethod: v.union(
        v.literal("cash"),
        v.literal("bank"),
        v.literal("easypaisa"),
        v.literal("jazzcash"),
      ),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_date", ["date"])
      .index("by_category", ["category"]),

    // ========== LEAVE REQUESTS ==========
    leaveRequests: defineTable({
      teacherId: v.id("teachers"),
      startDate: v.string(), // YYYY-MM-DD
      endDate: v.string(), // YYYY-MM-DD
      reason: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      reviewedBy: v.optional(v.id("users")),
      createdAt: v.number(),
    })
      .index("by_teacher", ["teacherId"])
      .index("by_status", ["status"]),

    // ========== FEE AUDIT LOGS ==========
    // Immutable audit trail for every fee operation (payment, refund, fine, cancellation).
    feeAuditLogs: defineTable({
      studentId: v.id("students"),
      action: v.union(
        v.literal("payment"),
        v.literal("refund"),
        v.literal("fine"),
        v.literal("fine_waived"),
        v.literal("cancellation"),
        v.literal("discount"),
        v.literal("charge"),
      ),
      amount: v.number(),
      period: v.optional(v.string()), // YYYY-MM
      referenceId: v.optional(v.string()), // payment ID, fine ID, etc.
      receiptNo: v.optional(v.string()),
      method: v.optional(feeMethodValidator),
      remarks: v.optional(v.string()),
      performedBy: v.id("users"),
      timestamp: v.number(),
    })
      .index("by_student", ["studentId"])
      .index("by_action", ["action"])
      .index("by_student_action", ["studentId", "action"]),

    // ========== FEE FINES ==========
    // Per-student fines (late fee, damage, disciplinary, etc.).
    feeFines: defineTable({
      studentId: v.id("students"),
      period: v.string(), // YYYY-MM
      label: v.string(), // e.g. "Late fee", "Library fine", "Damage"
      amount: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("waived"),
      ),
      paidAmount: v.optional(v.number()),
      dueDate: v.optional(v.string()), // YYYY-MM-DD
      reason: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_student", ["studentId"])
      .index("by_period", ["period"])
      .index("by_status", ["status"]),

    // ========== HOMEWORK TRACKING ==========
    homework: defineTable({
      classId: v.id("classes"),
      section: v.string(),
      subject: v.string(),
      title: v.string(),
      description: v.string(),
      assignedDate: v.string(), // YYYY-MM-DD
      dueDate: v.string(), // YYYY-MM-DD
      status: v.union(
        v.literal("assigned"),
        v.literal("collected"),
        v.literal("reviewed"),
      ),
      totalStudents: v.optional(v.number()),
      submittedCount: v.optional(v.number()),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_class_section", ["classId", "section"])
      .index("by_date", ["assignedDate"])
      .index("by_due", ["dueDate"]),

    // Per-student homework submission records
    homeworkSubmissions: defineTable({
      homeworkId: v.id("homework"),
      studentId: v.id("students"),
      status: v.union(
        v.literal("pending"),
        v.literal("submitted"),
        v.literal("late"),
        v.literal("absent"),
      ),
      submittedDate: v.optional(v.string()),
      marks: v.optional(v.number()),
      remarks: v.optional(v.string()),
      createdBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_homework", ["homeworkId"])
      .index("by_student", ["studentId"])
      .index("by_homework_student", ["homeworkId", "studentId"]),

    // ========== ACADEMIC SESSIONS / TERMS ==========
    academicSessions: defineTable({
      name: v.string(), // e.g. "2025-2026"
      startDate: v.string(), // YYYY-MM-DD
      endDate: v.string(), // YYYY-MM-DD
      status: v.union(
        v.literal("upcoming"),
        v.literal("active"),
        v.literal("completed"),
      ),
      createdBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_status", ["status"]),

    academicTerms: defineTable({
      sessionId: v.id("academicSessions"),
      name: v.string(), // e.g. "1st Term"
      term: v.union(
        v.literal("1st_term"),
        v.literal("2nd_term"),
        v.literal("final_term"),
      ),
      startDate: v.string(), // YYYY-MM-DD
      endDate: v.string(), // YYYY-MM-DD
      status: v.union(
        v.literal("upcoming"),
        v.literal("active"),
        v.literal("completed"),
      ),
      createdBy: v.id("users"),
      createdAt: v.number(),
    }).index("by_session", ["sessionId"]),

    // ========== STUDENT PROMOTIONS ==========
    studentPromotions: defineTable({
      studentId: v.id("students"),
      fromClassId: v.id("classes"),
      fromSection: v.string(),
      toClassId: v.id("classes"),
      toSection: v.string(),
      session: v.string(), // e.g. "2025-2026"
      reason: v.optional(v.string()),
      carryFees: v.boolean(), // carry previous balance forward
      createdBy: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_student", ["studentId"])
      .index("by_session", ["session"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
