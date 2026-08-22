import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  ArrowRight,
  Users,
  ArrowUpCircle,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

export default function BulkPromotion() {
  const classes = useQuery(api.classes.list) ?? [];
  const [fromClassId, setFromClassId] = useState("");
  const [fromSection, setFromSection] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [toSection, setToSection] = useState("");
  const [session, setSession] = useState(
    `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  );
  const [carryFees, setCarryFees] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [promoting, setPromoting] = useState(false);

  const students =
    useQuery(api.students.list, {
      classId: fromClassId ? (fromClassId as Id<"classes">) : undefined,
      status: "active",
    }) ?? [];

  const filtered = fromSection
    ? students.filter((s) => s.section === fromSection)
    : students;

  const fromClass = classes.find((c) => c._id === fromClassId);
  const toClass = classes.find((c) => c._id === toClassId);
  const promoteMutation = useMutation(api.promotions.bulkPromote);

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s._id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handlePromote = async () => {
    if (selected.size === 0) {
      toast.error("Select at least one student to promote.");
      return;
    }
    if (!toClassId || !toSection) {
      toast.error("Select target class and section.");
      return;
    }
    if (!confirm(`Promote ${selected.size} students to ${toClass?.name ?? "?"} ${toSection}?`)) return;

    setPromoting(true);
    try {
      const count = await promoteMutation({
        studentIds: Array.from(selected) as Id<"students">[],
        toClassId: toClassId as Id<"classes">,
        toSection,
        session,
        carryFees,
        reason: `Promoted from ${fromClass?.name ?? "?"} ${fromSection} — Session ${session}`,
      });
      toast.success(`${count} students promoted successfully!`);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e.message || "Promotion failed");
    }
    setPromoting(false);
  };

  const pastPromotions =
    useQuery(api.promotions.list, {
      session,
    }) ?? [];

  return (
    <AppShell title="Bulk Student Promotion">
      <div className="space-y-6">
        {/* Promotion Form */}
        <Card className="card-3d">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowUpCircle className="size-4" /> Promote Students to Next Class
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* From */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">
                  FROM
                </Label>
                <Select value={fromClassId} onValueChange={setFromClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Source class" />
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
                <Label className="text-xs invisible">Section</Label>
                <Select value={fromSection} onValueChange={setFromSection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {fromClass?.sections.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Arrow */}
              <div className="flex items-end justify-center">
                <ArrowRight className="size-5 text-primary" />
              </div>

              {/* To */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">
                  TO
                </Label>
                <Select value={toClassId} onValueChange={setToClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Target class" />
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
                <Label className="text-xs invisible">Section</Label>
                <Select value={toSection} onValueChange={setToSection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {toClass?.sections.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                    <SelectItem value="A">A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Academic Session</Label>
                <Input value={session} onChange={(e) => setSession(e.target.value)} />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Checkbox
                  id="carryFees"
                  checked={carryFees}
                  onCheckedChange={(v) => setCarryFees(!!v)}
                />
                <Label htmlFor="carryFees" className="text-sm flex items-center gap-1">
                  <Wallet className="size-3.5" /> Carry previous balance forward
                </Label>
              </div>
              <div className="flex items-end justify-end">
                <Button
                  disabled={selected.size === 0 || promoting}
                  onClick={handlePromote}
                >
                  {promoting
                    ? "Promoting..."
                    : `Promote ${selected.size} Students`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student List */}
        {filtered.length > 0 && (
          <Card className="card-3d">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="size-4" />
                  Students — {fromClass?.name ?? "?"} {fromSection}
                  <Badge variant="outline">{filtered.length} students</Badge>
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleAll}
                    />
                    <span className="text-muted-foreground">
                      {selected.size} selected
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Roll #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Father</TableHead>
                    <TableHead>Section</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow
                      key={s._id}
                      className={selected.has(s._id) ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(s._id)}
                          onCheckedChange={() => toggle(s._id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.rollNumber}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {s.name}
                      </TableCell>
                      <TableCell className="text-sm">{s.fatherName}</TableCell>
                      <TableCell className="text-sm">{s.section}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Past Promotions */}
        {pastPromotions.length > 0 && (
          <Card className="card-3d">
            <CardHeader>
              <CardTitle className="text-sm">
                Promotion History — {session}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Fees</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastPromotions.slice(0, 100).map((p) => (
                    <TableRow key={p._id}>
                      <TableCell className="font-medium text-sm">
                        {p.studentName}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.fromClassName} - {p.fromSection}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.toClassName} - {p.toSection}
                      </TableCell>
                      <TableCell>
                        {p.carryFees ? (
                          <Badge className="bg-amber-100 text-amber-700">
                            <Wallet className="size-3 mr-1" /> Carried
                          </Badge>
                        ) : (
                          <Badge variant="outline">Fresh</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(p.createdAt).toLocaleDateString()}
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
