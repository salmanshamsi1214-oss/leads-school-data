import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  MessageSquare,
  Printer,
  ReceiptText,
  Send,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BRAND, fullSchoolName } from "@/lib/brand";
import { FEE_METHOD_LABELS, formatPeriod } from "@/lib/fees";
import { formatDate, formatPkr, numberToWords } from "@/lib/format";
import logo from "@/assets/leads-logo.svg";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-dashed py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function SignatureBox({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center gap-10 pt-2 text-center">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <div className="w-full border-t border-dotted" />
    </div>
  );
}

export default function Receipt() {
  const { receiptId } = useParams<{ receiptId: string }>();
  const payment = useQuery(
    api.fees.receipt,
    receiptId ? { paymentId: receiptId as never } : "skip",
  );

  const backTo = "/fees";

  const [sending, setSending] = useState<"sms" | "whatsapp" | null>(null);
  const sendReceiptCopy = useAction(api.sms.sendReceiptCopy);

  const handleSendCopy = async (channel: "sms" | "whatsapp") => {
    if (!payment || sending !== null) return;
    setSending(channel);
    try {
      const result = await sendReceiptCopy({ paymentId: payment._id, channel });
      if (result.success) {
        toast.success(`Receipt sent by ${channel === "sms" ? "SMS" : "WhatsApp"}`, {
          description: result.to ? `To ${result.to}` : "Delivered to the guardian's phone.",
        });
      } else {
        toast.error(`Could not send by ${channel === "sms" ? "SMS" : "WhatsApp"}`, {
          description: result.message,
        });
      }
    } catch (error) {
      toast.error("Receipt could not be sent.", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Toolbar — hidden when printing */}
      <div className="print-hidden sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Button asChild variant="ghost" size="sm" className="cursor-pointer">
            <Link to={backTo}>
              <ArrowLeft className="size-4" />
              Fee management
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {payment && (
              <span className="hidden font-mono text-xs text-muted-foreground sm:block">
                {payment.receiptNo}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={payment === undefined || payment === null || sending !== null}
                  title={
                    payment && !payment.studentPhone
                      ? "No phone number on the student record"
                      : "Send a copy of this receipt"
                  }
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Send copy
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={sending !== null || !payment?.studentPhone}
                  onClick={() => handleSendCopy("whatsapp")}
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={sending !== null || !payment?.studentPhone}
                  onClick={() => handleSendCopy("sms")}
                >
                  <MessageSquare className="size-4" />
                  SMS
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              className="cursor-pointer"
              onClick={() => window.print()}
              disabled={payment === undefined || payment === null}
            >
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {payment === undefined ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : payment === null ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ReceiptText className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">Receipt not found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This receipt may have been deleted, or you don&apos;t have access to it.
              </p>
            </div>
            <Button asChild variant="outline" className="mt-2 cursor-pointer">
              <Link to={backTo}>Back to fee management</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm print:rounded-none print:border print:shadow-none">
            {/* Header */}
            <div className="border-b-4 border-primary bg-white px-6 py-6 sm:px-8">
              <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                <img
                  src={logo}
                  alt={`${BRAND.schoolName} logo`}
                  width={64}
                  height={64}
                  className="rounded-xl print:h-16 print:w-16"
                />
                <div className="flex-1 leading-tight">
                  <p className="text-lg font-extrabold tracking-tight text-foreground sm:text-xl">
                    {BRAND.schoolName}
                  </p>
                  <p className="text-sm font-semibold text-primary">{BRAND.campusName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {BRAND.address} · {BRAND.phones.join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 rounded-lg bg-primary px-4 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/80">
                    Receipt No
                  </p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-primary-foreground">
                    {payment.receiptNo}
                  </p>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="bg-secondary/60 px-6 py-4 sm:px-8">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-base font-extrabold uppercase tracking-wide text-foreground">
                  Fee Payment Receipt
                </h1>
                <p className="text-xs font-medium text-muted-foreground">
                  Period: <span className="font-semibold text-foreground">{formatPeriod(payment.period)}</span>{" "}
                  · Received on {formatDate(payment.date)}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6 sm:px-8">
              <div className="grid gap-x-10 gap-y-1 sm:grid-cols-2">
                <div>
                  <DetailRow label="Student name" value={payment.studentName} />
                  <DetailRow label="Father's name" value={payment.fatherName || "—"} />
                  <DetailRow label="Roll number" value={payment.rollNumber || "—"} />
                </div>
                <div>
                  <DetailRow label="Class" value={`${payment.className} · Section ${payment.section}`} />
                  <DetailRow label="Contact" value={payment.studentPhone || "—"} />
                  <DetailRow label="Payment method" value={FEE_METHOD_LABELS[payment.method]} />
                </div>
              </div>

              {/* Amount */}
              <div className="mt-6 overflow-hidden rounded-lg border">
                <div className="flex flex-col gap-3 bg-primary p-4 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/75">
                      Amount received
                    </p>
                    <p className="mt-0.5 text-3xl font-extrabold tracking-tight">
                      {formatPkr(payment.amount)}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/75">
                      In words
                    </p>
                    <p className="mt-0.5 max-w-xs text-sm font-semibold leading-5">
                      Rupees {numberToWords(payment.amount)} Only
                    </p>
                  </div>
                </div>
                {payment.remarks && (
                  <p className="bg-background px-4 py-2 text-xs text-muted-foreground">
                    Remarks: {payment.remarks}
                  </p>
                )}
              </div>

              {/* Signatures */}
              <div className="mt-10 grid grid-cols-3 gap-6">
                <SignatureBox title="Received by" />
                <SignatureBox title="Accountant" />
                <SignatureBox title="Parent / Guardian" />
              </div>

              <p className="mt-10 text-center text-[11px] leading-5 text-muted-foreground">
                This is a computer-generated receipt from {fullSchoolName}. For
                queries, contact the school office at {BRAND.phones.join(" or ")}.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
