import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageLoader({
  text,
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-48 items-center justify-center gap-3",
        className,
      )}
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}
