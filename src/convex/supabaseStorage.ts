import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Server-side Supabase helpers.
 *
 * These Convex actions run in Node.js so they can read SECRET env vars
 * that are never exposed to the browser.  The browser client only ever
 * receives pre-signed URLs that expire.
 */

function getSupabaseAdmin() {
  // Dynamic import so the module stays tree-shakeable in browser bundles.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase credentials are not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the Keys tab.",
    );
  }
  return createClient(url, key);
}

/* ------------------------------------------------------------------ */
/*  Upload                                                            */
/* ------------------------------------------------------------------ */

/**
 * Upload a file (as a base64 string) to Supabase Storage and return
 * a public download URL.
 *
 * @param bucket  – Storage bucket name (e.g. "student-photos")
 * @param path    – Full object path inside the bucket
 * @param fileBase64 – Base64-encoded file content (without data-URI prefix)
 * @param contentType – MIME type (e.g. "image/jpeg")
 */
export const uploadFile = action({
  args: {
    bucket: v.string(),
    path: v.string(),
    fileBase64: v.string(),
    contentType: v.string(),
  },
  handler: async (_ctx, args) => {
    const supabase = getSupabaseAdmin();
    const buffer = Buffer.from(args.fileBase64, "base64");

    const { error } = await supabase.storage
      .from(args.bucket)
      .upload(args.path, buffer, {
        contentType: args.contentType,
        upsert: true,
      });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    // Return a signed URL valid for 1 year (max for Supabase free tier)
    const { data: signed, error: signErr } = await supabase.storage
      .from(args.bucket)
      .createSignedUrl(args.path, 31536000);

    if (signErr) throw new Error(`Signed URL failed: ${signErr.message}`);
    return signed.signedUrl;
  },
});

/* ------------------------------------------------------------------ */
/*  Delete                                                             */
/* ------------------------------------------------------------------ */

export const deleteFile = action({
  args: {
    bucket: v.string(),
    path: v.string(),
  },
  handler: async (_ctx, args) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(args.bucket)
      .remove([args.path]);
    if (error) throw new Error(`Delete failed: ${error.message}`);
    return true;
  },
});

/* ------------------------------------------------------------------ */
/*  Create bucket (run once during setup)                              */
/* ------------------------------------------------------------------ */

export const ensureBucket = action({
  args: { bucket: v.string() },
  handler: async (_ctx, args) => {
    const supabase = getSupabaseAdmin();
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b: { name: string }) => b.name === args.bucket);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(args.bucket, {
        public: false,
        fileSizeLimit: 5 * 1024 * 1024, // 5 MB
        allowedMimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ],
      });
      if (error) throw new Error(`Bucket creation failed: ${error.message}`);
    }
    return true;
  },
});

/* ------------------------------------------------------------------ */
/*  Generate signed URL for an existing file                           */
/* ------------------------------------------------------------------ */

export const getSignedUrl = action({
  args: {
    bucket: v.string(),
    path: v.string(),
  },
  handler: async (_ctx, args) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(args.bucket)
      .createSignedUrl(args.path, 3600); // 1 hour
    if (error) throw new Error(`Signed URL failed: ${error.message}`);
    return data.signedUrl;
  },
});

/* ------------------------------------------------------------------ */
/*  List files in a folder                                             */
/* ------------------------------------------------------------------ */

export const listFiles = action({
  args: {
    bucket: v.string(),
    folder: v.string(),
  },
  handler: async (_ctx, args) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(args.bucket)
      .list(args.folder, { limit: 100 });
    if (error) throw new Error(`List failed: ${error.message}`);
    return data ?? [];
  },
});
