import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  AlarmClock,
  BarChart3,
  BookCheck,
  BookOpen,
  BookUser,
  PrinterCheck,
  Bot,
  Cake,
  CalendarDays,
  ClipboardCheck,
  FileCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  MessageSquareText,
  PartyPopper,
  PanelLeftDashed,
  PhoneCall,
  Receipt,
  School,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import logo from "@/assets/leads-logo.svg";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { BRAND } from "@/lib/brand";
import { formatRole } from "@/lib/roles";
import { ScrollNavButtons } from "@/components/scroll-nav-buttons";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  officeOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Students & Staff",
    items: [
      { to: "/students", label: "Students", icon: GraduationCap },
      { to: "/teachers", label: "Teachers", icon: BookUser },
      { to: "/classes", label: "Classes", icon: School },
      { to: "/admissions", label: "Admission Inquiry", icon: PhoneCall },
      { to: "/bulk-import", label: "Bulk Import Students", icon: Users, adminOnly: true },
      { to: "/bulk-promotion", label: "Student Promotion", icon: GraduationCap, adminOnly: true },
    ],
  },
  {
    label: "Attendance",
    items: [
      { to: "/attendance", label: "Mark Attendance", icon: ClipboardCheck },
      { to: "/late-comers", label: "Late Comers", icon: AlarmClock },
      { to: "/monthly-attendance-report", label: "Monthly Report", icon: BarChart3 },
    ],
  },
  {
    label: "Academics",
    items: [
      { to: "/diary", label: "Diary", icon: BookOpen },
      { to: "/tests", label: "Daily / Weekly Tests", icon: Target },
      { to: "/exams", label: "Exams & Results", icon: FileText },
      { to: "/notebook-check", label: "Notebook Check", icon: BookCheck },
      { to: "/timetable", label: "Timetable", icon: CalendarDays },
      { to: "/lesson-planner", label: "Lesson Planner", icon: BookOpen },
      { to: "/syllabus", label: "Syllabus Management", icon: Target },
      { to: "/homework", label: "Homework Tracker", icon: BookCheck },
      { to: "/robot-lab", label: "Robotics Lab", icon: Bot },
      { to: "/activity-submissions", label: "Activity Submissions", icon: FileCheck },
      { to: "/activities", label: "Activities", icon: PartyPopper },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/fees", label: "Fee Management", icon: Wallet },
      { to: "/fee-slips", label: "Fee Slips & Challans", icon: Receipt },
      { to: "/payroll", label: "Payroll", icon: Receipt },
      { to: "/expenses", label: "Expenses", icon: Wallet },
    ],
  },
  {
    label: "Communication",
    items: [
      { to: "/notices", label: "Notices", icon: Megaphone },
      { to: "/messages", label: "Messages", icon: MessageSquareText, officeOnly: true },
      { to: "/birthdays", label: "Birthdays", icon: Cake },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3 },
      { to: "/print-formats", label: "Print Formats", icon: PrinterCheck },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/admin", label: "Admin Dashboard", icon: PanelLeftDashed, adminOnly: true },
      { to: "/academic-sessions", label: "Academic Sessions", icon: CalendarDays, adminOnly: true },
      { to: "/parent", label: "Parent View", icon: Users, adminOnly: true },
      { to: "/teacher", label: "Teacher View", icon: UserCheck, adminOnly: true },
      { to: "/staff", label: "Staff & Roles", icon: ShieldCheck, adminOnly: true },
    ],
  },
];

function userInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return email?.slice(0, 2).toUpperCase() ?? "A";
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md animate-pulse-glow" />
        <img
          src={logo}
          alt={`${BRAND.schoolName} logo`}
          width={36}
          height={36}
          className="relative rounded-lg ring-2 ring-primary/20 shadow-lg shadow-primary/10"
        />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-sidebar-primary-foreground gradient-text">
          {BRAND.shortName}
        </p>
        <p className="text-[10px] text-sidebar-foreground/50 font-medium">{BRAND.campusName}</p>
      </div>
    </div>
  );
}

const OFFICE_ROLES_SET = new Set(["admin", "principal", "vice_principal", "accountant", "receptionist", "librarian"]);

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <nav className="flex flex-col gap-4" aria-label="Main navigation">
      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter(
          (item) =>
            (!item.adminOnly || isAdmin) &&
            (!item.officeOnly || OFFICE_ROLES_SET.has(user?.role ?? "")),
        );
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "nav-3d flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5",
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function SignOutButton({ className }: { className?: string }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("justify-start gap-2", className)}
      onClick={handleSignOut}
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  );
}

function SidebarFooter() {
  const { user } = useAuth();
  return (
    <div className="border-t border-sidebar-border px-4 py-3">
      <div className="flex items-center gap-2 rounded-xl glass px-3 py-2.5">
        <Avatar className="size-9 ring-2 ring-primary/30 shadow-md">
          <AvatarFallback className="bg-gradient-to-br from-primary to-orange-400 text-white text-xs font-bold">
            {userInitials(user?.name, user?.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold text-sidebar-foreground">
            {user?.name ?? "School account"}
          </p>
          <p className="text-[10px] text-sidebar-foreground/50">{formatRole(user?.role)}</p>
        </div>
      </div>
      <SignOutButton className="mt-2 w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 gap-2 rounded-full px-2 sm:px-3">
          <Avatar className="size-9 ring-2 ring-primary/20 shadow-md shadow-primary/10">
            <AvatarFallback className="bg-gradient-to-br from-primary to-orange-400 text-white text-xs font-bold">
              {userInitials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-36 truncate text-sm font-medium sm:block">
            {user?.name ?? user?.email ?? "Account"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{user?.name ?? "School account"}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {user?.email ?? "Signed in"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="print-hidden fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar sidebar-3d lg:flex">
        <div className="relative flex h-16 items-center border-b border-sidebar-border px-5 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <NavList />
        </div>
        <SidebarFooter />
      </aside>

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="print-hidden sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6 header-3d">
          <div className="flex items-center gap-2">
            {/* Mobile drawer */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="print-hidden lg:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
                <SheetHeader className="h-16 border-b border-sidebar-border px-5">
                  <SheetTitle className="text-sidebar-foreground">
                    <Brand />
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <NavList onNavigate={() => setDrawerOpen(false)} />
                </div>
                <div className="border-t border-sidebar-border px-4 py-3">
                  <SignOutButton className="w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
                </div>
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <Brand />
            </div>
            <div className="hidden lg:block">
              <h1 className="text-base font-bold tracking-tight">{title}</h1>
            </div>
          </div>
          <UserMenu />
        </header>
        <motion.main
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8"
        >
          <div className="mb-4 lg:hidden">
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          </div>
          {children}
        </motion.main>
        <ScrollNavButtons />
      </div>
    </div>
  );
}
