import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Trash2,
  Edit,
  Users,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";

type HomeworkRecord = {
  _id: Id<"homework">;
  classId: Id<"classes">;
  section: string;
  subject: string;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  status: "assigned" | "collected" | "reviewed";
  totalStudents?: number;
  submittedCount?: number;
  className?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export default function HomeworkTracker() {
  const classes = useQuery(api.classes.list) ?? [];
  const stats = useQuery(api.homework.stats);
  const [classId, setClassId] = useState<string>("");
  const [section, setSection] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<HomeworkRecord | null>(null);
  const [activeTab, setActiveTab] = useState("list");

  // Form state
  const [formClassId, setFormClassId] = useState<string>("");
  const [formSection, setFormSection] = useState<string>("");
  const [formSubject, setFormSubject] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAssignedDate, setFormAssignedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [formDueDate, setFormDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const homework = useQuery(api.homework.list, {
    classId: classId ? (classId as Id<"classes">) : undefined,
    section: section || undefined,
    subject: subject || undefined,
    search: search || undefined,
  }) ?? [];

  const createHomework = useMutation(api.homework.create);
  const updateHomework = useMutation(api.homework.update);
  const removeHomework = useMutation(api.homework.remove);
  const bulkMarkSubmitted = useMutation(api.homework.bulkMarkAllSubmitted);

  const selectedClass = classes.find((c) => c._id === classId);
  const formSelectedClass = classes.find((c) => c._id === formClassId);

  const subjects = useMemo(() => {
    const s = new Set<string>();
    homework.forEach((h) => s.add(h.subject));
    return Array.from(s).sort();
  }, [homework]);

  const resetForm = () => {
    setFormClassId("");
    setFormSection("");
    setFormSubject("");
    setFormTitle("");
    setFormDescription("");
    setFormAssignedDate(new Date().toISOString().slice(0, 10));
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setFormDueDate(d.toISOString().slice(0, 10));
    setEditItem(null);
  };

  const handleSubmit = async () => {
    if (!formClassId || !formSection || !formSubject || !formTitle || !formDescription) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      if (editItem) {
        await updateHomework({
          id: editItem._id,
          classId: formClassId as Id<"classes">,
          section: formSection,
          subject: formSubject,
          title: formTitle,
          description: formDescription,
          assignedDate: formAssignedDate,
          dueDate: formDueDate,
        });
        toast.success("Homework updated!");
      } else {
        await createHomework({
          classId: formClassId as Id<"classes">,
          section: formSection,
          subject: formSubject,
          title: formTitle,
          description: formDescription,
          assignedDate: formAssignedDate,
          dueDate: formDueDate,
        });
        toast.success("Homework assigned! Pending submissions auto-created.");
      }
      setFormOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message || "Failed to save homework");
    }
  };

  const handleEdit = (item: HomeworkRecord) => {
    setEditItem(item);
    setFormClassId(item.classId);
    setFormSection(item.section);
    setFormSubject(item.subject);
    setFormTitle(item.title);
    setFormDescription(item.description);
    setFormAssignedDate(item.assignedDate);
    setFormDueDate(item.dueDate);
    setFormOpen(true);
  };

  const handleDelete = async (id: Id<"homework">) => {
    if (!confirm("Delete this homework and all its submissions?")) return;
    try {
      await removeHomework({ id });
      toast.success("Homework deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const handleBulkSubmit = async (id: Id<"homework">) => {
    if (!confirm("Mark all pending students as submitted?")) return;
    try {
      await bulkMarkSubmitted({ homeworkId: id });
      toast.success("All submissions marked as submitted!");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const statusBadge = (s: string, dueDate: string) => {
    if (s === "reviewed") return <Badge className="bg-blue-100 text-blue-700">Reviewed</Badge>;
    if (s === "collected") return <Badge className="bg-green-100 text-green-700">Collected</Badge>;
    if (dueDate < today) return <Badge className="bg-red-100 text-red-700">Overdue</Badge>;
    return <Badge className="bg-amber-100 text-amber-700">Assigned</Badge>;
  };

  return (
    <AppShell title="Homework Tracker">
      <div className="space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="card-3d">
              <CardContent className="p-4 text-center">
                <BookOpen className="size-6 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Assigned</p>
              </CardContent>
            </Card>
            <Card className="card-3d">
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="size-6 mx-auto text-green-500 mb-1" />
                <p className="text-2xl font-bold">{stats.collected}</p>
                <p className="text-xs text-muted-foreground">Collected</p>
              </CardContent>
            </Card>
            <Card className="card-3d">
              <CardContent className="p-4 text-center">
                <Clock className="size-6 mx-auto text-amber-500 mb-1" />
                <p className="text-2xl font-bold">{stats.assigned}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card className="card-3d">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="size-6 mx-auto text-red-500 mb-1" />
                <p className="text-2xl font-bold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters + Add */}
        <Card className="card-3d">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClass && selectedClass.sections.length > 0 && (
                <div className="min-w-[120px]">
                  <Label className="text-xs">Section</Label>
                  <Select value={section} onValueChange={setSection}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sections</SelectItem>
                      {selectedClass.sections.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="min-w-[150px]">
                <Label className="text-xs">Subject</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search homework..."
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <Dialog
                open={formOpen}
                onOpenChange={(open) => {
                  if (!open) resetForm();
                  setFormOpen(open);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      resetForm();
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" /> Assign Homework
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editItem ? "Edit Homework" : "Assign New Homework"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Class *</Label>
                        <Select value={formClassId} onValueChange={setFormClassId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            {classes.map((c) => (
                              <SelectItem key={c._id} value={c._id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Section *</Label>
                        <Select value={formSection} onValueChange={setFormSection}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {formSelectedClass?.sections.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Subject *</Label>
                      <Input
                        value={formSubject}
                        onChange={(e) => setFormSubject(e.target.value)}
                        placeholder="e.g. Mathematics"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Title *</Label>
                      <Input
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Homework title"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Description *</Label>
                      <Textarea
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Detailed description of the homework..."
                        rows={4}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Assigned Date</Label>
                        <Input
                          type="date"
                          value={formAssignedDate}
                          onChange={(e) => setFormAssignedDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Due Date</Label>
                        <Input
                          type="date"
                          value={formDueDate}
                          onChange={(e) => setFormDueDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button onClick={handleSubmit} className="w-full">
                      {editItem ? "Update" : "Assign Homework"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Homework List */}
        {homework.length === 0 ? (
          <Card className="card-3d">
            <CardContent className="p-12 text-center">
              <BookOpen className="size-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No homework found. Assign some!</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="card-3d">
            <CardHeader>
              <CardTitle className="text-sm">Homework ({homework.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {homework.map((h) => (
                    <TableRow key={h._id}>
                      <TableCell className="font-medium">{h.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{h.subject}</Badge>
                      </TableCell>
                      <TableCell>
                        {h.className} - {h.section}
                      </TableCell>
                      <TableCell className="text-xs">{h.assignedDate}</TableCell>
                      <TableCell className="text-xs">{h.dueDate}</TableCell>
                      <TableCell>{statusBadge(h.status, h.dueDate)}</TableCell>
                      <TableCell>
                        <span className="text-xs font-medium">
                          {h.submittedCount ?? 0}/{h.totalStudents ?? "?"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEdit(h)}
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleBulkSubmit(h._id)}
                          >
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(h._id)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
