import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  CalendarDays,
  CheckCircle2,
  Clock,
  Trash2,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";

export default function AcademicSessions() {
  const sessions = useQuery(api.academicSessions.listSessions) ?? [];
  const createSession = useMutation(api.academicSessions.createSession);
  const updateSessionStatus = useMutation(api.academicSessions.updateSessionStatus);
  const updateTermStatus = useMutation(api.academicSessions.updateTermStatus);
  const removeSession = useMutation(api.academicSessions.removeSession);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState(`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
  const [startDate, setStartDate] = useState(`${new Date().getFullYear()}-04-01`);
  const [endDate, setEndDate] = useState(`${new Date().getFullYear() + 1}-03-31`);

  // Fetch terms for each session
  const TermsList = ({ sessionId }: { sessionId: Id<"academicSessions"> }) => {
    const terms =
      useQuery(api.academicSessions.listTerms, { sessionId }) ?? [];
    return (
      <div className="space-y-2">
        {terms.length === 0 ? (
          <p className="text-xs text-muted-foreground">No terms yet</p>
        ) : (
          <div className="space-y-1">
            {terms.map((t) => (
              <div
                key={t._id}
                className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5"
              >
                <div>
                  <p className="text-xs font-medium">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t.startDate} → {t.endDate}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {t.status === "active" && (
                    <Badge className="bg-green-100 text-green-700 text-[10px]">
                      Active
                    </Badge>
                  )}
                  {t.status === "completed" && (
                    <Badge className="bg-blue-100 text-blue-700 text-[10px]">
                      Completed
                    </Badge>
                  )}
                  {t.status === "upcoming" && (
                    <Badge variant="outline" className="text-[10px]">
                      Upcoming
                    </Badge>
                  )}
                  <Select
                    value={t.status}
                    onValueChange={(v) =>
                      updateTermStatus({
                        id: t._id,
                        status: v as "upcoming" | "active" | "completed",
                      })
                    }
                  >
                    <SelectTrigger className="w-24 h-6 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleCreate = async () => {
    if (!name || !startDate || !endDate) {
      toast.error("Fill all fields");
      return;
    }
    try {
      await createSession({ name, startDate, endDate });
      toast.success("Session created with 3 terms!");
      setFormOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: Id<"academicSessions">) => {
    if (!confirm("Delete this session and all its terms?")) return;
    try {
      await removeSession({ id });
      toast.success("Session deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const activeSessions = sessions.filter((s) => s.status === "active");
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const upcomingSessions = sessions.filter((s) => s.status === "upcoming");

  return (
    <AppShell title="Academic Sessions & Terms">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="card-3d">
            <CardContent className="p-4 text-center">
              <CalendarDays className="size-5 mx-auto text-green-500 mb-1" />
              <p className="text-2xl font-bold">{activeSessions.length}</p>
              <p className="text-xs text-muted-foreground">Active Sessions</p>
            </CardContent>
          </Card>
          <Card className="card-3d">
            <CardContent className="p-4 text-center">
              <Clock className="size-5 mx-auto text-amber-500 mb-1" />
              <p className="text-2xl font-bold">{upcomingSessions.length}</p>
              <p className="text-xs text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
          <Card className="card-3d">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="size-5 mx-auto text-blue-500 mb-1" />
              <p className="text-2xl font-bold">{completedSessions.length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Create Button */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" /> New Academic Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Academic Session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Session Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="2025-2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Three terms (1st, 2nd, Final) will be automatically created and
                evenly distributed across the session dates.
              </p>
              <Button onClick={handleCreate} className="w-full">
                Create Session + 3 Terms
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Sessions List */}
        {sessions.length === 0 ? (
          <Card className="card-3d">
            <CardContent className="p-12 text-center">
              <GraduationCap className="size-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                No academic sessions. Create one to start tracking terms!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sessions.map((s) => (
              <Card key={s._id} className="card-3d">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-sm">{s.name}</CardTitle>
                      {s.status === "active" && (
                        <Badge className="bg-green-100 text-green-700">
                          Active
                        </Badge>
                      )}
                      {s.status === "completed" && (
                        <Badge className="bg-blue-100 text-blue-700">
                          Completed
                        </Badge>
                      )}
                      {s.status === "upcoming" && (
                        <Badge variant="outline">Upcoming</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={s.status}
                        onValueChange={(v) =>
                          updateSessionStatus({
                            id: s._id,
                            status: v as "upcoming" | "active" | "completed",
                          })
                        }
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upcoming">Upcoming</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(s._id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {s.startDate} → {s.endDate}
                  </p>
                  <TermsList sessionId={s._id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
