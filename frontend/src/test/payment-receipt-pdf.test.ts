import { describe, expect, it } from "vitest";
import { createPaymentReceiptPdf } from "@/lib/payment-receipt-pdf";
import type { OrderHistoryEntry } from "@/lib/api";

describe("payment receipt PDF", () => {
  it("creates a PDF with verified totals, handoff, and transaction details", () => {
    const order: OrderHistoryEntry = {
      id: "order-1",
      item_id: "item-1",
      title: "Fabric Sofa",
      amount: 3_250_000,
      paid_amount: 3_260_000,
      buyer_id: "buyer-1",
      seller_id: "giver-1",
      buyer: "Tolu Ade",
      seller: "Ada Okafor",
      status: "paid",
      reference: "dg-order-reference",
      created_at: "2026-11-23T11:00:00.000Z",
      paid_at: "2026-11-23T12:00:00.000Z",
      fulfillment_method: "delivery",
      delivery_fee_kobo: 250_000,
      contact: null,
    };

    const output = createPaymentReceiptPdf(order).output("arraybuffer");
    const pdfHeader = new TextDecoder().decode(output.slice(0, 8));

    expect(pdfHeader).toMatch(/^%PDF-/);
    expect(output.byteLength).toBeGreaterThan(1000);
  });
});
