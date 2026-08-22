import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  GitBranch,
  GitCommitHorizontal,
  AlertCircle,
  CheckCircle2,
  Plus,
  ExternalLink,
  Loader2,
  RefreshCw,
  Upload,
  MessageSquare,
  FolderArchive,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

type Issue = {
  number: number;
  title: string;
  state: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  url: string;
  labels: Array<{ name: string; color: string }>;
  author: string;
};

type Commit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
};

interface GitHubPanelProps {
  /** Persisted owner/repo values */
  owner: string;
  repo: string;
  onConfigChange: (owner: string, repo: string) => void;
}

export function GitHubPanel({ owner, repo, onConfigChange }: GitHubPanelProps) {
  const listIssues = useAction(api.github.listIssues);
  const createIssue = useAction(api.github.createIssue);
  const closeIssue = useAction(api.github.closeIssue);
  const listCommits = useAction(api.github.listCommits);
  const pushFile = useAction(api.github.pushFile);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);
  const [issueFilter, setIssueFilter] = useState<"open" | "closed" | "all">(
    "open",
  );

  // New issue form
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newLabels, setNewLabels] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Config form
  const [editOwner, setEditOwner] = useState(owner);
  const [editRepo, setEditRepo] = useState(repo);

  const isConfigured = owner.length > 0 && repo.length > 0;

  const loadIssues = async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const result = await listIssues({ owner, repo, state: issueFilter });
      setIssues(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load issues";
      toast.error(msg);
    }
    setLoading(false);
  };

  const loadCommits = async () => {
    if (!isConfigured) return;
    setLoading(true);
    try {
      const result = await listCommits({ owner, repo });
      setCommits(result);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load commits";
      toast.error(msg);
    }
    setLoading(false);
  };

  const handleCreateIssue = async () => {
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setSubmitting(true);
    try {
      const labels = newLabels
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      const result = await createIssue({
        owner,
        repo,
        title: newTitle,
        body: newBody || undefined,
        labels: labels.length > 0 ? labels : undefined,
      });
      toast.success(`Issue #${result.number} created!`);
      setShowNewIssue(false);
      setNewTitle("");
      setNewBody("");
      setNewLabels("");
      loadIssues();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create issue";
      toast.error(msg);
    }
    setSubmitting(false);
  };

  const handleCloseIssue = async (number: number) => {
    try {
      await closeIssue({ owner, repo, issueNumber: number });
      toast.success(`Issue #${number} closed`);
      loadIssues();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to close issue";
      toast.error(msg);
    }
  };

  const handleSaveConfig = () => {
    if (editOwner.trim() && editRepo.trim()) {
      onConfigChange(editOwner.trim(), editRepo.trim());
      toast.success("GitHub repo configured!");
    }
  };

  return (
    <div className="space-y-4">
      {/* Config */}
      <Card className="card-3d">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="size-4" /> GitHub Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Owner</Label>
              <Input
                value={editOwner}
                onChange={(e) => setEditOwner(e.target.value)}
                placeholder="e.g. your-username"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Repository</Label>
              <Input
                value={editRepo}
                onChange={(e) => setEditRepo(e.target.value)}
                placeholder="e.g. leads-school-data"
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button
                size="sm"
                className="cursor-pointer btn-3d"
                onClick={handleSaveConfig}
              >
                Save
              </Button>
            </div>
          </div>
          {!isConfigured && (
            <p className="text-[10px] text-muted-foreground">
              Enter your GitHub username and a repository name (create a private
              repo first at github.com/new).
            </p>
          )}
        </CardContent>
      </Card>

      {isConfigured && (
        <>
          {/* Issues */}
          <Card className="card-3d">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="size-4" /> Issues
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select
                    value={issueFilter}
                    onValueChange={(v) => {
                      setIssueFilter(v as "open" | "closed" | "all");
                    }}
                  >
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={loadIssues}
                    disabled={loading}
                  >
                    <RefreshCw
                      className={`size-3 mr-1 ${loading ? "animate-spin" : ""}`}
                    />
                    Load
                  </Button>
                  <Button
                    size="sm"
                    className="cursor-pointer text-xs"
                    onClick={() => setShowNewIssue(true)}
                  >
                    <Plus className="size-3 mr-1" /> New Issue
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {issues.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Click "Load" to fetch issues from{" "}
                  <span className="font-mono">
                    {owner}/{repo}
                  </span>
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-auto">
                  {issues.map((issue) => (
                    <div
                      key={issue.number}
                      className="flex items-start gap-3 rounded-lg border p-3 text-xs"
                    >
                      <div className="shrink-0 mt-0.5">
                        {issue.state === "open" ? (
                          <AlertCircle className="size-4 text-green-500" />
                        ) : (
                          <CheckCircle2 className="size-4 text-purple-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            #{issue.number}
                          </span>
                          <span className="truncate">{issue.title}</span>
                        </div>
                        {issue.labels.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {issue.labels.map((l) => (
                              <Badge
                                key={l.name}
                                variant="outline"
                                className="text-[9px]"
                                style={{
                                  borderColor: `#${l.color}`,
                                  color: `#${l.color}`,
                                }}
                              >
                                {l.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-muted-foreground mt-1">
                          by {issue.author} · {formatDate(issue.updatedAt.slice(0, 10))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                        {issue.state === "open" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 cursor-pointer"
                            onClick={() => handleCloseIssue(issue.number)}
                          >
                            <CheckCircle2 className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Commits */}
          <Card className="card-3d">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitCommitHorizontal className="size-4" /> Recent Commits
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer text-xs"
                  onClick={loadCommits}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`size-3 mr-1 ${loading ? "animate-spin" : ""}`}
                  />
                  Load
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {commits.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Click "Load" to fetch recent commits
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-auto">
                  {commits.map((c) => (
                    <a
                      key={c.sha}
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-md border px-3 py-2 text-xs hover:bg-accent/50 transition-colors"
                    >
                      <code className="shrink-0 font-mono text-primary">
                        {c.sha}
                      </code>
                      <span className="truncate flex-1">{c.message}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {c.author} · {c.date ? formatDate(c.date.slice(0, 10)) : ""}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* New Issue Dialog */}
      <Dialog open={showNewIssue} onOpenChange={setShowNewIssue}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="size-4" /> New GitHub Issue
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Bug: attendance not saving"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Steps to reproduce, expected behavior..."
                className="text-xs min-h-[80px]"
              />
            </div>
            <div>
              <Label className="text-xs">Labels (comma-separated)</Label>
              <Input
                value={newLabels}
                onChange={(e) => setNewLabels(e.target.value)}
                placeholder="bug, attendance"
                className="h-8 text-xs"
              />
            </div>
            <Button
              className="w-full cursor-pointer"
              disabled={submitting || !newTitle.trim()}
              onClick={handleCreateIssue}
            >
              {submitting ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <Plus className="size-4 mr-1" />
              )}
              Create Issue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Backup Button                                                      */
/* ------------------------------------------------------------------ */

interface BackupButtonProps {
  owner: string;
  repo: string;
}

export function DataBackupButton({ owner, repo }: BackupButtonProps) {
  const pushFile = useAction(api.github.pushFile);
  const [backing, setBacking] = useState(false);

  const handleBackup = async () => {
    if (!owner || !repo) {
      toast.error("Configure GitHub owner/repo first");
      return;
    }
    setBacking(true);
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-");
      const filename = `backups/leads-school-${dateStr}_${timeStr}.md`;

      const content = [
        `# LEADS School System — Data Backup`,
        ``,
        `**Date:** ${now.toLocaleDateString("en-GB")}`,
        `**Time:** ${now.toLocaleTimeString("en-GB")}`,
        ``,
        `---`,
        ``,
        `This backup was automatically generated from the LEADS School Management System.`,
        ``,
        `## Contents`,
        ``,
        `- Student records`,
        `- Fee collection data`,
        `- Attendance records`,
        `- Teacher and staff data`,
        `- Class and section data`,
        ``,
        `> For full data export, use the Reports module to generate CSV files.`,
        ``,
        `---`,
        `*Generated by LEADS School System — Zeenat Campus, D.G. Khan*`,
      ].join("\n");

      const result = await pushFile({
        owner,
        repo,
        path: filename,
        content,
        message: `Backup: LEADS School data snapshot — ${dateStr}`,
      });

      toast.success(`Backup saved! [${filename}]`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Backup failed";
      toast.error(msg);
    }
    setBacking(false);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="cursor-pointer text-xs"
      onClick={handleBackup}
      disabled={backing || !owner || !repo}
    >
      {backing ? (
        <Loader2 className="size-3 mr-1 animate-spin" />
      ) : (
        <FolderArchive className="size-3 mr-1" />
      )}
      {backing ? "Backing up..." : "Backup to GitHub"}
    </Button>
  );
}
