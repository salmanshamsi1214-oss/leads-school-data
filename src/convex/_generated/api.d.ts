/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as academicSessions from "../academicSessions.js";
import type * as activities from "../activities.js";
import type * as activitySubmissions from "../activitySubmissions.js";
import type * as analytics from "../analytics.js";
import type * as attendance from "../attendance.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as classes from "../classes.js";
import type * as dailyTests from "../dailyTests.js";
import type * as dashboard from "../dashboard.js";
import type * as diary from "../diary.js";
import type * as exams from "../exams.js";
import type * as expenses from "../expenses.js";
import type * as feeManagement from "../feeManagement.js";
import type * as feeSlips from "../feeSlips.js";
import type * as fees from "../fees.js";
import type * as github from "../github.js";
import type * as homework from "../homework.js";
import type * as http from "../http.js";
import type * as inquiries from "../inquiries.js";
import type * as lessonPlanner from "../lessonPlanner.js";
import type * as lessonPlans from "../lessonPlans.js";
import type * as messages from "../messages.js";
import type * as notebookChecks from "../notebookChecks.js";
import type * as notices from "../notices.js";
import type * as payroll from "../payroll.js";
import type * as permissions from "../permissions.js";
import type * as progressReport from "../progressReport.js";
import type * as promotions from "../promotions.js";
import type * as robotLab from "../robotLab.js";
import type * as settings from "../settings.js";
import type * as sms from "../sms.js";
import type * as studentProfile from "../studentProfile.js";
import type * as students from "../students.js";
import type * as supabaseStorage from "../supabaseStorage.js";
import type * as syllabus from "../syllabus.js";
import type * as teachers from "../teachers.js";
import type * as timetable from "../timetable.js";
import type * as users from "../users.js";
import type * as weeklyTests from "../weeklyTests.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  academicSessions: typeof academicSessions;
  activities: typeof activities;
  activitySubmissions: typeof activitySubmissions;
  analytics: typeof analytics;
  attendance: typeof attendance;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  classes: typeof classes;
  dailyTests: typeof dailyTests;
  dashboard: typeof dashboard;
  diary: typeof diary;
  exams: typeof exams;
  expenses: typeof expenses;
  feeManagement: typeof feeManagement;
  feeSlips: typeof feeSlips;
  fees: typeof fees;
  github: typeof github;
  homework: typeof homework;
  http: typeof http;
  inquiries: typeof inquiries;
  lessonPlanner: typeof lessonPlanner;
  lessonPlans: typeof lessonPlans;
  messages: typeof messages;
  notebookChecks: typeof notebookChecks;
  notices: typeof notices;
  payroll: typeof payroll;
  permissions: typeof permissions;
  progressReport: typeof progressReport;
  promotions: typeof promotions;
  robotLab: typeof robotLab;
  settings: typeof settings;
  sms: typeof sms;
  studentProfile: typeof studentProfile;
  students: typeof students;
  supabaseStorage: typeof supabaseStorage;
  syllabus: typeof syllabus;
  teachers: typeof teachers;
  timetable: typeof timetable;
  users: typeof users;
  weeklyTests: typeof weeklyTests;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
