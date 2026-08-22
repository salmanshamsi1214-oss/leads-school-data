import { useState, useRef, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface FileUploadProps {
  /** Supabase Storage bucket name */
  bucket: string;
  /** Path inside the bucket (e.g. "students/STU001/photo.jpg") */
  path: string;
  /** Current URL (for displaying existing file) */
  currentUrl?: string | null;
  /** Called with the new public URL after successful upload */
  onUploaded: (url: string) => void;
  /** Called when the file is deleted */
  onDeleted?: () => void;
  /** Accepted MIME types */
  accept?: string;
  /** Max file size in MB */
  maxSizeMb?: number;
  /** Show as small inline button instead of dropzone */
  compact?: boolean;
  /** Label text */
  label?: string;
}

export function FileUpload({
  bucket,
  path,
  currentUrl,
  onUploaded,
  onDeleted,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  maxSizeMb = 5,
  compact = false,
  label = "Upload File",
}: FileUploadProps) {
  const uploadFile = useAction(api.supabaseStorage.uploadFile);
  const deleteFile = useAction(api.supabaseStorage.deleteFile);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (file.size > maxSizeMb * 1024 * 1024) {
        toast.error(`File too large. Maximum size is ${maxSizeMb} MB.`);
        return;
      }

      setUploading(true);
      try {
        // Convert to base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            // Strip data-URI prefix
            const b64 = result.split(",")[1] ?? result;
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const url = await uploadFile({
          bucket,
          path,
          fileBase64: base64,
          contentType: file.type || "application/octet-stream",
        });

        onUploaded(url);
        toast.success("File uploaded successfully!");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
      }
      setUploading(false);
    },
    [bucket, path, maxSizeMb, uploadFile, onUploaded],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFile({ bucket, path });
      onDeleted?.();
      toast.success("File deleted.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast.error(msg);
    }
    setDeleting(false);
  };

  const isImage =
    currentUrl &&
    (currentUrl.includes(".jpg") ||
      currentUrl.includes(".jpeg") ||
      currentUrl.includes(".png") ||
      currentUrl.includes(".webp") ||
      currentUrl.includes("image"));

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleInputChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer text-xs"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-3.5 mr-1 animate-spin" />
          ) : (
            <Upload className="size-3.5 mr-1" />
          )}
          {uploading ? "Uploading..." : label}
        </Button>
        {currentUrl && onDeleted && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="cursor-pointer text-xs text-destructive"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <X className="size-3.5" />
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Preview */}
      {currentUrl && (
        <div className="relative group">
          {isImage ? (
            <img
              src={currentUrl}
              alt="Uploaded file"
              className="w-full h-40 object-cover rounded-lg border"
            />
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
              <FileText className="size-8 text-primary" />
              <span className="text-xs text-muted-foreground truncate">
                Uploaded document
              </span>
            </div>
          )}
          {onDeleted && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 size-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <X className="size-3" />
              )}
            </Button>
          )}
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2
          border-dashed cursor-pointer transition-colors
          ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
          ${uploading ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        {uploading ? (
          <Loader2 className="size-6 text-primary animate-spin" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground text-center">
          {uploading
            ? "Uploading..."
            : "Drag & drop or click to upload\nMax 5 MB — JPEG, PNG, WebP, PDF"}
        </p>
      </div>
    </div>
  );
}
