import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatTone = "default" | "success" | "danger" | "warning" | "info";

const TONE_CLASSES: Record<StatTone, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-700",
  danger: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-blue-100 text-blue-700",
};

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg",
            TONE_CLASSES[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight">{value}</p>
          {sub && (
            <p className="truncate text-xs text-muted-foreground">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
