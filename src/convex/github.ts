import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Server-side GitHub API helpers.
 *
 * All GitHub calls run as Convex actions (Node.js) so the token is never
 * exposed to the browser.  The browser only triggers actions and receives
 * the results.
 */

const GITHUB_API = "https://api.github.com";

function getGithubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GitHub token is not configured. Add GITHUB_TOKEN in the Keys tab.",
    );
  }
  return token;
}

function headers() {
  return {
    Authorization: `Bearer ${getGithubToken()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

/* ------------------------------------------------------------------ */
/*  Repository info                                                    */
/* ------------------------------------------------------------------ */

export const getRepoInfo = action({
  args: {
    owner: v.string(),
    repo: v.string(),
  },
  handler: async (_ctx, args) => {
    const res = await fetch(
      `${GITHUB_API}/repos/${args.owner}/${args.repo}`,
      { headers: headers() },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }
    return await res.json();
  },
});

/* ------------------------------------------------------------------ */
/*  Issues                                                             */
/* ------------------------------------------------------------------ */

export const listIssues = action({
  args: {
    owner: v.string(),
    repo: v.string(),
    state: v.optional(
      v.union(v.literal("open"), v.literal("closed"), v.literal("all")),
    ),
    perPage: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const state = args.state ?? "open";
    const perPage = args.perPage ?? 20;
    const res = await fetch(
      `${GITHUB_API}/repos/${args.owner}/${args.repo}/issues?state=${state}&per_page=${perPage}&sort=updated&direction=desc`,
      { headers: headers() },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }
    const issues = (await res.json()) as Array<{
      number: number;
      title: string;
      state: string;
      body: string | null;
      created_at: string;
      updated_at: string;
      html_url: string;
      labels: Array<{ name: string; color: string }>;
      user: { login: string } | null;
    }>;
    // Filter out pull requests (GitHub lists them as issues too)
    return issues
      .filter((i) => !("pull_request" in i))
      .map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        body: i.body ?? "",
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        url: i.html_url,
        labels: i.labels.map((l) => ({ name: l.name, color: l.color })),
        author: i.user?.login ?? "unknown",
      }));
  },
});

export const createIssue = action({
  args: {
    owner: v.string(),
    repo: v.string(),
    title: v.string(),
    body: v.optional(v.string()),
    labels: v.optional(v.array(v.string())),
  },
  handler: async (_ctx, args) => {
    const res = await fetch(
      `${GITHUB_API}/repos/${args.owner}/${args.repo}/issues`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          title: args.title,
          body: args.body ?? "",
          labels: args.labels ?? [],
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }
    const issue = (await res.json()) as {
      number: number;
      html_url: string;
      title: string;
    };
    return {
      number: issue.number,
      url: issue.html_url,
      title: issue.title,
    };
  },
});

export const closeIssue = action({
  args: {
    owner: v.string(),
    repo: v.string(),
    issueNumber: v.number(),
  },
  handler: async (_ctx, args) => {
    const res = await fetch(
      `${GITHUB_API}/repos/${args.owner}/${args.repo}/issues/${args.issueNumber}`,
      {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ state: "closed" }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }
    return true;
  },
});

/* ------------------------------------------------------------------ */
/*  File push (backup)                                                 */
/* ------------------------------------------------------------------ */

/**
 * Create or update a file in the repository.
 * Used for data backups — CSV snapshots of students, fees, attendance, etc.
 */
export const pushFile = action({
  args: {
    owner: v.string(),
    repo: v.string(),
    path: v.string(),
    content: v.string(), // Raw text content (will be base64-encoded)
    message: v.string(),
    branch: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const branch = args.branch ?? "main";
    const contentB64 = Buffer.from(args.content).toString("base64");

    // Check if file exists to get its SHA (required for updates)
    let sha: string | undefined;
    const checkRes = await fetch(
      `${GITHUB_API}/repos/${args.owner}/${args.repo}/contents/${args.path}?ref=${branch}`,
      { headers: headers() },
    );
    if (checkRes.ok) {
      const existing = (await checkRes.json()) as { sha?: string };
      sha = existing.sha;
    }

    const body: Record<string, string> = {
      message: args.message,
      content: contentB64,
      branch,
    };
    if (sha) body.sha = sha;

    const res = await fetch(
      `${GITHUB_API}/repos/${args.owner}/${args.repo}/contents/${args.path}`,
      {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${text}`);
    }
    const result = (await res.json()) as { content?: { html_url?: string } };
    return { url: result.content?.html_url ?? "", path: args.path };
  },
});

/* ------------------------------------------------------------------ */
/*  List recent commits                                                */
/* ------------------------------------------------------------------ */

export const listCommits = action({
  args: {
    owner: v.string(),
    repo: v.string(),
    perPage: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const perPage = args.perPage ?? 10;
    const res = await fetch(
      `${GITHUB_API}/repos/${args.owner}/${args.repo}/commits?per_page=${perPage}`,
      { headers: headers() },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }
    const commits = (await res.json()) as Array<{
      sha: string;
      commit: {
        message: string;
        author: { name: string; date: string } | null;
      };
      html_url: string;
    }>;
    return commits.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0],
      author: c.commit.author?.name ?? "unknown",
      date: c.commit.author?.date ?? "",
      url: c.html_url,
    }));
  },
});
