import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Upload, FileText, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";

type ParsedStudent = {
  name: string;
  fatherName: string;
  rollNumber: string;
  classId: string;
  section: string;
  phone?: string;
  birthDate?: string;
  gender?: "male" | "female";
  valid: boolean;
  error?: string;
};

export default function BulkImportStudents() {
  const classes = useQuery(api.classes.list) ?? [];
  const createStudent = useMutation(api.students.create);
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedStudent[]>([]);
  const [defaultClassId, setDefaultClassId] = useState<string>("");
  const [defaultSection, setDefaultSection] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<
    Array<{ name: string; ok: boolean; error?: string }>
  >([]);

  const defaultClass = classes.find((c) => c._id === defaultClassId);

  const parseCSV = useCallback(
    (text: string) => {
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length < 2) {
        toast.error("CSV must have a header row and at least one student row.");
        return;
      }

      const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
      const nameIdx = header.findIndex((h) => h.includes("name") && !h.includes("father"));
      const fatherIdx = header.findIndex((h) => h.includes("father"));
      const rollIdx = header.findIndex((h) => h.includes("roll"));
      const sectionIdx = header.findIndex((h) => h.includes("section"));
      const phoneIdx = header.findIndex((h) => h.includes("phone"));
      const dobIdx = header.findIndex((h) => h.includes("dob") || h.includes("birth"));
      const genderIdx = header.findIndex((h) => h.includes("gender") || h.includes("sex"));

      if (nameIdx === -1 || fatherIdx === -1 || rollIdx === -1) {
        toast.error(
          "CSV must have columns: name, fatherName, rollNumber (at minimum).",
        );
        return;
      }

      const students: ParsedStudent[] = lines.slice(1).map((line) => {
        // Simple CSV parse (handles quoted fields)
        const cells: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of line) {
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === "," && !inQuotes) {
            cells.push(current.trim());
            current = "";
          } else {
            current += ch;
          }
        }
        cells.push(current.trim());

        const name = cells[nameIdx]?.trim() ?? "";
        const fatherName = cells[fatherIdx]?.trim() ?? "";
        const rollNumber = cells[rollIdx]?.trim() ?? "";
        const section = cells[sectionIdx]?.trim().toUpperCase() ?? defaultSection;
        const phone = cells[phoneIdx]?.trim() ?? undefined;
        const birthDate = cells[dobIdx]?.trim() ?? undefined;
        const genderRaw = cells[genderIdx]?.trim().toLowerCase() ?? undefined;
        const gender =
          genderRaw === "male" || genderRaw === "m" || genderRaw === "boy"
            ? "male"
            : genderRaw === "female" || genderRaw === "f" || genderRaw === "girl"
              ? "female"
              : undefined;

        let valid = true;
        let error = "";
        if (!name) {
          valid = false;
          error = "Missing name";
        } else if (!fatherName) {
          valid = false;
          error = "Missing father name";
        } else if (!rollNumber) {
          valid = false;
          error = "Missing roll number";
        }

        return {
          name,
          fatherName,
          rollNumber,
          classId: defaultClassId,
          section: section || "A",
          phone,
          birthDate,
          gender: gender as "male" | "female" | undefined,
          valid,
          error,
        };
      });

      setParsed(students);
      setResults([]);
      toast.success(`Parsed ${students.length} students from CSV.`);
    },
    [defaultClassId, defaultSection],
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) parseCSV(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!defaultClassId) {
      toast.error("Please select a default class first.");
      return;
    }
    const valid = parsed.filter((s) => s.valid);
    if (valid.length === 0) {
      toast.error("No valid students to import.");
      return;
    }

    setImporting(true);
    const newResults: Array<{ name: string; ok: boolean; error?: string }> = [];

    for (const s of valid) {
      try {
        await createStudent({
          name: s.name,
          fatherName: s.fatherName,
          rollNumber: s.rollNumber,
          classId: s.classId as Id<"classes">,
          section: s.section,
          phone: s.phone,
          birthDate: s.birthDate,
          gender: s.gender,
        });
        newResults.push({ name: s.name, ok: true });
      } catch (err: any) {
        newResults.push({ name: s.name, ok: false, error: err.message });
      }
    }

    setResults(newResults);
    setImporting(false);
    const successCount = newResults.filter((r) => r.ok).length;
    toast.success(`Imported ${successCount}/${valid.length} students.`);
  };

  const downloadTemplate = () => {
    const csv = "name,fatherName,rollNumber,section,phone,dob,gender\nAhmed Ali,Muhammad Ali,R001,A,03001234567,2015-03-15,male\nSara Bibi,Abdul Karim,R002,B,03011234567,2015-07-20,female\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsed.filter((s) => s.valid).length;
  const invalidCount = parsed.filter((s) => !s.valid).length;
  const importedCount = results.filter((r) => r.ok).length;
  const failedCount = results.filter((r) => !r.ok).length;

  return (
    <AppShell title="Bulk Import Students">
      <div className="space-y-6">
        {/* Instructions */}
        <Card className="card-3d">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="size-4" /> Import Students from CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                Download the CSV template and fill in student data
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                Select default class and section, then upload the CSV
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                Review parsed students and click Import to add them
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="size-4" /> Download Template
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Default Class *</Label>
                <Select value={defaultClassId} onValueChange={setDefaultClassId}>
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
              {defaultClass && defaultClass.sections.length > 0 && (
                <div>
                  <Label className="text-xs">Default Section</Label>
                  <Select value={defaultSection} onValueChange={setDefaultSection}>
                    <SelectTrigger>
                      <SelectValue placeholder="A" />
                    </SelectTrigger>
                    <SelectContent>
                      {defaultClass.sections.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Upload CSV</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <FileText className="size-4" /> Choose CSV File
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {parsed.length > 0 && (
          <Card className="card-3d">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Preview ({parsed.length} rows)
                </CardTitle>
                <div className="flex gap-2">
                  <Badge className="bg-green-100 text-green-700">
                    {validCount} valid
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge className="bg-red-100 text-red-700">
                      {invalidCount} invalid
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    disabled={validCount === 0 || importing}
                    onClick={handleImport}
                  >
                    {importing ? "Importing..." : `Import ${validCount} Students`}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Father</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((s, i) => (
                    <TableRow
                      key={i}
                      className={!s.valid ? "bg-red-50/50" : ""}
                    >
                      <TableCell className="text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">
                        {s.name}
                      </TableCell>
                      <TableCell className="text-sm">{s.fatherName}</TableCell>
                      <TableCell className="text-sm">{s.rollNumber}</TableCell>
                      <TableCell className="text-sm">{s.section}</TableCell>
                      <TableCell className="text-xs">{s.phone ?? "—"}</TableCell>
                      <TableCell>
                        {s.valid ? (
                          <CheckCircle2 className="size-4 text-green-500" />
                        ) : (
                          <span className="text-xs text-red-500">{s.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Import Results */}
        {results.length > 0 && (
          <Card className="card-3d">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle className="text-sm">Import Results</CardTitle>
                <Badge className="bg-green-100 text-green-700">
                  {importedCount} imported
                </Badge>
                {failedCount > 0 && (
                  <Badge className="bg-red-100 text-red-700">
                    {failedCount} failed
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">
                        {r.name}
                      </TableCell>
                      <TableCell>
                        {r.ok ? (
                          <CheckCircle2 className="size-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="size-4 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-red-500">
                        {r.error ?? "—"}
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
