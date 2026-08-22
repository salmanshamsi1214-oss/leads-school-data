import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Loader2, Pencil, Plus, School, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

type ClassRow = Doc<"classes"> & { studentCount: number };

function ClassFormDialog({
  open,
  onOpenChange,
  cls,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cls?: ClassRow | null;
}) {
  const createClass = useMutation(api.classes.create);
  const updateClass = useMutation(api.classes.update);
  const [name, setName] = useState("");
  const [sections, setSections] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(cls?.name ?? "");
      setSections(cls?.sections.join(", ") ?? "");
    }
  }, [open, cls]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast("Class name is required.");
      return;
    }
    const sectionList = sections
      .split(",")
      .map((section) => section.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      if (cls) {
        await updateClass({
          id: cls._id,
          name: trimmedName,
          sections: sectionList,
        });
        toast(`${trimmedName} updated.`);
      } else {
        await createClass({ name: trimmedName, sections: sectionList });
        toast(`${trimmedName} added.`);
      }
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not save the class.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cls ? "Edit class" : "Add class"}</DialogTitle>
          <DialogDescription>
            {cls
              ? `Update ${cls.name}. Existing student records are kept.`
              : "Add a class such as Nursery, Prep, or Class 6."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="class-name">Class name *</Label>
            <Input
              id="class-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Class 6"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="class-sections">
              Sections <span className="text-muted-foreground">(comma separated)</span>
            </Label>
            <Input
              id="class-sections"
              value={sections}
              onChange={(e) => setSections(e.target.value)}
              placeholder="A, B, C"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty if the class has no sections.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {cls ? "Save changes" : "Add class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Classes() {
  const classes = useQuery(api.classes.list);
  const removeClass = useMutation(api.classes.remove);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await removeClass({ id: deleting._id });
      toast(`${deleting.name} deleted.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not delete the class.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppShell title="Classes">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {classes === undefined ? "Loading classes…" : `${classes.length} class${classes.length === 1 ? "" : "es"} on the register`}
          </p>
          <Button className="cursor-pointer" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="size-4" />
            Add class
          </Button>
        </div>

        {classes === undefined ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <School className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">No classes yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add classes like Nursery, Prep, Class 6 … Matric before enrolling students.
              </p>
            </div>
            <Button className="cursor-pointer" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="size-4" />
              Add class
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls) => (
              <div key={cls._id} className="flex flex-col rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold tracking-tight">{cls.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {cls.studentCount} active student{cls.studentCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="cursor-pointer"
                      aria-label={`Edit ${cls.name}`}
                      onClick={() => { setEditing(cls); setFormOpen(true); }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="cursor-pointer text-red-600 hover:text-red-600"
                      aria-label={`Delete ${cls.name}`}
                      onClick={() => setDeleting(cls)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {cls.sections.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No sections</span>
                  ) : (
                    cls.sections.map((section) => (
                      <Badge key={section} variant="secondary">
                        Section {section}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ClassFormDialog open={formOpen} onOpenChange={setFormOpen} cls={editing} />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Delete {deleting?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the class from the register. Classes with enrolled
              students cannot be deleted — move the students first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={confirmDelete}>
              Delete class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
