import { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarCheck2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  GraduationCap,
  FolderArchive,
  Loader2,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { GitHubPanel, DataBackupButton } from "@/components/github-panel";
import { formatPkr } from "@/lib/format";

export default function AdminDashboard() {
  const [ghOwner, setGhOwner] = useState(
    () => localStorage.getItem("gh_owner") ?? "",
  );
  const [ghRepo, setGhRepo] = useState(
    () => localStorage.getItem("gh_repo") ?? "",
  );

  const handleGhConfig = (owner: string, repo: string) => {
    setGhOwner(owner);
    setGhRepo(repo);
    localStorage.setItem("gh_owner", owner);
    localStorage.setItem("gh_repo", repo);
  };

  const data = useQuery(api.analytics.adminOverview);

  if (data === undefined) {
    return (
      <AppShell title="Admin Dashboard">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="Admin Dashboard">
        <p className="text-sm text-muted-foreground">Could not load admin data.</p>
      </AppShell>
    );
  }

  const expenseChartData = data.expenseTrend;

  const categoryColors = [
    "#ef4444",
    "#3b82f6",
    "#f97316",
    "#22c55e",
    "#a855f7",
    "#eab308",
    "#06b6d4",
    "#64748b",
  ];

  return (
    <AppShell title="Admin Dashboard">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Financial Overview</h2>
            <p className="text-sm text-muted-foreground">School-wide operational summary</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Students"
            value={data.students.active}
            sub={`${data.students.total} total`}
            icon={Users}
          />
          <StatCard
            label="Teachers"
            value={data.teachers.active}
            sub={`${data.teachers.total} total`}
            icon={GraduationCap}
          />
          <StatCard
            label="Today's attendance"
            value={`${data.attendance.today.rate}%`}
            sub={`${data.attendance.today.present} present · ${data.attendance.today.absent} absent`}
            icon={CalendarCheck2}
            tone={data.attendance.today.rate >= 80 ? "success" : "danger"}
          />
          <StatCard
            label="New inquiries"
            value={data.inquiries.new}
            sub={`${data.inquiries.total} total`}
            icon={FileText}
            tone={data.inquiries.new > 0 ? "warning" : "default"}
          />
        </div>

        {/* Financial cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Fees collected"
            value={formatPkr(data.fees.collected)}
            sub="This month"
            icon={Wallet}
            tone="success"
          />
          <StatCard
            label="Payroll this month"
            value={formatPkr(data.payroll.current)}
            sub={`${formatPkr(data.payroll.pending)} pending`}
            icon={Receipt}
            tone="warning"
          />
          <StatCard
            label="Expenses this month"
            value={formatPkr(data.expenses.currentMonth)}
            sub={
              data.expenses.trend === "up"
                ? "↑ from last month"
                : data.expenses.trend === "down"
                  ? "↓ from last month"
                  : "Same as last month"
            }
            icon={CircleDollarSign}
            tone={data.expenses.trend === "up" ? "danger" : "default"}
          />
          <StatCard
            label="Year expenses"
            value={formatPkr(data.expenses.year)}
            sub={`${data.classes} classes`}
            icon={FileText}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Expense trend chart */}
          <Card className="shadow-none lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Expense Trend</CardTitle>
              <CardDescription>Last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseChartData} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6e4e0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "#8a8f98" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#8a8f98" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [formatPkr(Number(value)), "Expenses"]}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="amount" fill="#ea580c" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Expense by category */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Expenses by Category</CardTitle>
              <CardDescription>Year to date</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.expenses.byCategory.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No expenses this year.
                </p>
              ) : (
                data.expenses.byCategory.map((cat, i) => (
                  <div key={cat.category}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium capitalize">{cat.category}</span>
                      <span className="font-semibold">{formatPkr(cat.amount)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            (cat.amount / data.expenses.byCategory[0].amount) * 100,
                            100,
                          )}%`,
                          backgroundColor: categoryColors[i % categoryColors.length],
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { to: "/payroll", label: "Payroll", icon: Receipt },
                { to: "/expenses", label: "Expenses", icon: CircleDollarSign },
                { to: "/reports", label: "Reports", icon: FileText },
                { to: "/admissions", label: "Inquiries", icon: Users },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/60"
                >
                  <link.icon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{link.label}</span>
                  <ChevronRight className="ml-auto size-4 text-muted-foreground/50" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* GitHub Integration */}
        <div className="grid gap-6 lg:grid-cols-2">
          <GitHubPanel
            owner={ghOwner}
            repo={ghRepo}
            onConfigChange={handleGhConfig}
          />
          <Card className="card-3d">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderArchive className="size-4" /> Data Backup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Export a snapshot of school data to your GitHub repository for safekeeping.
                Configure the GitHub owner and repo above first.
              </p>
              <DataBackupButton owner={ghOwner} repo={ghRepo} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
