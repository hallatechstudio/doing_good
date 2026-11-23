import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderHistoryEntry } from "@/lib/api";

export function PaymentReceiptDownload({ order }: { order: OrderHistoryEntry }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    try {
      const { downloadPaymentReceipt } = await import("@/lib/payment-receipt-pdf");
      downloadPaymentReceipt(order);
    } catch {
      setError("Could not create your receipt. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void download()}
        disabled={busy}
      >
        <Download className="size-4" />
        {busy ? "Preparing PDF…" : "Download PDF receipt"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
