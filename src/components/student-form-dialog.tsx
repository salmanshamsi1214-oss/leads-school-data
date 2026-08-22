import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClassWithCount = Doc<"classes"> & { studentCount: number };

const emptyForm = {
  name: "",
  fatherName: "",
  rollNumber: "",
  classId: "",
  section: "",
  admissionDate: "",
  birthDate: "",
  phone: "",
};

export function StudentFormDialog({
  open,
  onOpenChange,
  classes,
  student,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ClassWithCount[];
  student?: Doc<"students"> | null;
}) {
  const createStudent = useMutation(api.students.create);
  const updateStudent = useMutation(api.students.update);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        student
          ? {
              name: student.name,
              fatherName: student.fatherName,
              rollNumber: student.rollNumber,
              classId: student.classId,
              section: student.section,
              admissionDate: student.admissionDate ?? "",
              birthDate: student.birthDate ?? "",
              phone: student.phone ?? "",
            }
          : emptyForm,
      );
    }
  }, [open, student]);

  const selectedClass = classes.find((cls) => cls._id === form.classId);
  const sectionOptions =
    selectedClass && selectedClass.sections.length > 0
      ? selectedClass.sections
      : ["A", "B", "C", "D"];

  const set = (field: keyof typeof emptyForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.fatherName.trim() || !form.rollNumber.trim()) {
      toast("Please fill in the student name, father's name, and roll number.");
      return;
    }
    if (!form.classId) {
      toast("Please choose a class.");
      return;
    }
    if (!form.section.trim()) {
      toast("Please choose a section.");
      return;
    }
    setSaving(true);
    try {
      if (student) {
        await updateStudent({
          id: student._id,
          name: form.name,
          fatherName: form.fatherName,
          rollNumber: form.rollNumber,
          classId: form.classId as never,
          section: form.section,
          admissionDate: form.admissionDate || undefined,
          birthDate: form.birthDate || undefined,
          phone: form.phone || undefined,
        });
        toast(`${form.name} updated.`);
      } else {
        await createStudent({
          name: form.name,
          fatherName: form.fatherName,
          rollNumber: form.rollNumber,
          classId: form.classId as never,
          section: form.section,
          admissionDate: form.admissionDate || undefined,
          birthDate: form.birthDate || undefined,
          phone: form.phone || undefined,
        });
        toast(`${form.name} added to the register.`);
      }
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the student.", {
        description: "Check the details and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{student ? "Edit student" : "Add student"}</DialogTitle>
          <DialogDescription>
            {student
              ? `Update ${student.name}'s register details.`
              : "Enrol a new student in the attendance register."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="student-name">Student name *</Label>
              <Input
                id="student-name"
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="e.g. Ayesha Khan"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="father-name">Father&apos;s name *</Label>
              <Input
                id="father-name"
                value={form.fatherName}
                onChange={(e) => set("fatherName")(e.target.value)}
                placeholder="e.g. Muhammad Khan"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="roll-number">Roll number *</Label>
              <Input
                id="roll-number"
                value={form.rollNumber}
                onChange={(e) => set("rollNumber")(e.target.value)}
                placeholder="e.g. 5A-12"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Contact number</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => set("phone")(e.target.value)}
                placeholder="03xx-xxxxxxx"
                inputMode="tel"
              />
            </div>
            <div className="grid gap-2">
              <Label>Class *</Label>
              <Select value={form.classId} onValueChange={(value) => set("classId")(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Section *</Label>
              <Select value={form.section} onValueChange={(value) => set("section")(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a section" />
                </SelectTrigger>
                <SelectContent>
                  {sectionOptions.map((section) => (
                    <SelectItem key={section} value={section}>
                      Section {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admission-date">Admission date</Label>
              <Input
                id="admission-date"
                type="date"
                value={form.admissionDate}
                onChange={(e) => set("admissionDate")(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="birth-date">Date of birth</Label>
              <Input
                id="birth-date"
                type="date"
                value={form.birthDate}
                onChange={(e) => set("birthDate")(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {student ? "Save changes" : "Add student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
