import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { RoleGate } from "@/components/role-gate";
import { OFFICE_ROLES, SCHOOL_ROLES } from "@/lib/roles";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Students = lazy(() => import("./pages/Students.tsx"));
const Classes = lazy(() => import("./pages/Classes.tsx"));
const Attendance = lazy(() => import("./pages/Attendance.tsx"));
const LateComers = lazy(() => import("./pages/LateComers.tsx"));
const Diary = lazy(() => import("./pages/Diary.tsx"));
const Reports = lazy(() => import("./pages/Reports.tsx"));
const Teachers = lazy(() => import("./pages/Teachers.tsx"));
const Messages = lazy(() => import("./pages/Messages.tsx"));
const Notices = lazy(() => import("./pages/Notices.tsx"));
const Fees = lazy(() => import("./pages/Fees.tsx"));
const Receipt = lazy(() => import("./pages/Receipt.tsx"));
const Staff = lazy(() => import("./pages/Staff.tsx"));
const Exams = lazy(() => import("./pages/Exams.tsx"));
const AdmissionInquiry = lazy(() => import("./pages/AdmissionInquiry.tsx"));
const NotebookCheck = lazy(() => import("./pages/NotebookCheck.tsx"));
const Tests = lazy(() => import("./pages/Tests.tsx"));
const Timetable = lazy(() => import("./pages/Timetable.tsx"));
const LessonPlanner = lazy(() => import("./pages/LessonPlanner.tsx"));
const SyllabusManagement = lazy(() => import("./pages/SyllabusManagement.tsx"));
const RobotLab = lazy(() => import("./pages/RobotLab.tsx"));
const ActivitySubmissions = lazy(() => import("./pages/ActivitySubmissions.tsx"));
const FeeSlips = lazy(() => import("./pages/FeeSlips.tsx"));
const Activities = lazy(() => import("./pages/Activities.tsx"));
const Birthdays = lazy(() => import("./pages/Birthdays.tsx"));
const StudentProfile = lazy(() => import("./pages/StudentProfile.tsx"));
const Payroll = lazy(() => import("./pages/Payroll.tsx"));
const Expenses = lazy(() => import("./pages/Expenses.tsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const ParentApp = lazy(() => import("./pages/ParentApp.tsx"));
const TeacherApp = lazy(() => import("./pages/TeacherApp.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const PrintFormats = lazy(() => import("./pages/PrintFormats.tsx"));
const HomeworkTracker = lazy(() => import("./pages/HomeworkTracker.tsx"));
const BulkImportStudents = lazy(() => import("./pages/BulkImportStudents.tsx"));
const BulkPromotion = lazy(() => import("./pages/BulkPromotion.tsx"));
const MonthlyAttendanceReport = lazy(() => import("./pages/MonthlyAttendanceReport.tsx"));
const AcademicSessions = lazy(() => import("./pages/AcademicSessions.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


// PWA: register the service worker in production builds only. It caches the
// static app shell; attendance data itself is always fetched fresh.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/dashboard" />}
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Dashboard />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/attendance"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Attendance />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/late-comers"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <LateComers />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/diary"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Diary />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/students"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Students />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/classes"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Classes />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/reports"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Reports />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/teachers"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Teachers />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/fees"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Fees />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/messages"
                element={
                  <RequireAuth>
                    <RoleGate roles={OFFICE_ROLES}>
                      <Messages />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/admissions"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <AdmissionInquiry />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/notebook-check"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <NotebookCheck />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/tests"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Tests />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/timetable"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Timetable />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/syllabus"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <SyllabusManagement />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/lesson-planner"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <LessonPlanner />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/exams"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Exams />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/robot-lab"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <RobotLab />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/activity-submissions"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <ActivitySubmissions />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/notices"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Notices />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/staff"
                element={
                  <RequireAuth>
                    <RoleGate roles={["admin"]}>
                      <Staff />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/fee-slips"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <FeeSlips />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/activities"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Activities />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/birthdays"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Birthdays />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/payroll"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Payroll />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/expenses"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Expenses />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <RoleGate roles={["admin"]}>
                      <AdminDashboard />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/parent"
                element={
                  <RequireAuth>
                    <RoleGate roles={["parent", "admin", "principal"]}>
                      <ParentApp />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/teacher"
                element={
                  <RequireAuth>
                    <RoleGate roles={["teacher", "admin", "principal"]}>
                      <TeacherApp />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/students/:id"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <StudentProfile />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/receipts/:receiptId"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <Receipt />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/print-formats"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <PrintFormats />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/homework"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <HomeworkTracker />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/bulk-import"
                element={
                  <RequireAuth>
                    <RoleGate roles={["admin"]}>
                      <BulkImportStudents />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/bulk-promotion"
                element={
                  <RequireAuth>
                    <RoleGate roles={["admin"]}>
                      <BulkPromotion />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/monthly-attendance-report"
                element={
                  <RequireAuth>
                    <RoleGate roles={SCHOOL_ROLES}>
                      <MonthlyAttendanceReport />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route
                path="/academic-sessions"
                element={
                  <RequireAuth>
                    <RoleGate roles={["admin"]}>
                      <AcademicSessions />
                    </RoleGate>
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
