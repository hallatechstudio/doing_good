import { jsPDF } from "jspdf";
import type { OrderHistoryEntry } from "./api";

const currency = (kobo: number) =>
  `NGN ${new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kobo / 100)}`;

function statusLabel(status: string) {
  switch (status) {
    case "paid":
      return "FUNDS HELD - AWAITING HANDOFF";
    case "delivery_pending":
      return "FUNDS HELD - DELIVERY UPDATE PROCESSING";
    case "delivered":
      return "FUNDS HELD - AWAITING RECEIVER CONFIRMATION";
    case "disputed":
      return "FUNDS HELD - DISPUTE REVIEW";
    case "release_pending":
    case "payout_processing":
      return "PAYMENT RELEASE PROCESSING";
    case "released":
      return "PAYMENT RELEASED TO GIVER";
    case "refund_pending":
    case "refund_review":
      return "REFUND UNDER REVIEW";
    case "refunded":
      return "PAYMENT REFUNDED";
    default:
      return "FUNDS HELD UNTIL DELIVERY CONFIRMATION";
  }
}

export function createPaymentReceiptPdf(order: OrderHistoryEntry) {
  const pdf = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const right = pageWidth - margin;
  const deliveryFee = order.delivery_fee_kobo ?? 0;
  const itemAmount = Math.max(0, order.amount - deliveryFee);
  const verifiedAmount = order.paid_amount ?? null;

  pdf.setFillColor(24, 67, 130);
  pdf.rect(0, 0, pageWidth, 47, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("DoingGood", margin, 22);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("A receipt for a meaningful exchange", margin, 30);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("PAYMENT RECEIPT", right, 21, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("ORIGINAL TRANSACTION RECORD", right, 28, { align: "right" });

  pdf.setTextColor(25, 39, 58);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  const titleLines = pdf.splitTextToSize(order.title, pageWidth - margin * 2);
  pdf.text(titleLines, margin, 59);
  let y = 59 + titleLines.length * 7 + 7;

  pdf.setFillColor(241, 246, 253);
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 29, 3, 3, "F");
  pdf.setTextColor(91, 106, 126);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(verifiedAmount == null ? "ORDER TOTAL" : "VERIFIED AMOUNT PAID", margin + 7, y + 9);
  pdf.setTextColor(24, 67, 130);
  pdf.setFontSize(19);
  pdf.text(currency(verifiedAmount ?? order.amount), margin + 7, y + 20);
  pdf.setTextColor(49, 66, 90);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  const status = statusLabel(order.status);
  pdf.text(pdf.splitTextToSize(status, 70), right - 7, y + 11, { align: "right" });
  y += 40;

  const drawDetail = (label: string, value: string) => {
    pdf.setDrawColor(225, 230, 237);
    pdf.line(margin, y, right, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(104, 116, 132);
    pdf.text(label, margin, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(35, 48, 67);
    const lines = pdf.splitTextToSize(value, 103);
    pdf.text(lines, right, y, { align: "right" });
    y += Math.max(5, lines.length * 4) + 3;
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(25, 39, 58);
  pdf.text("Transaction details", margin, y);
  y += 4;
  drawDetail("Payment reference", order.reference);
  drawDetail(
    "Payment date",
    order.paid_at ? new Date(order.paid_at).toLocaleString("en-NG") : "Not available",
  );
  drawDetail("Receiver", order.buyer);
  drawDetail("Giver", order.seller);
  drawDetail("Handoff", order.fulfillment_method === "delivery" ? "Delivery" : "Pickup");

  y += 7;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(25, 39, 58);
  pdf.text("Payment breakdown", margin, y);
  y += 4;
  drawDetail("Item price", currency(itemAmount));
  if (deliveryFee > 0) drawDetail("Delivery", currency(deliveryFee));
  drawDetail("Order total", currency(order.amount));
  if (verifiedAmount != null) {
    drawDetail("Verified amount paid", currency(verifiedAmount));
    if (verifiedAmount > order.amount)
      drawDetail("Amount above order total", currency(verifiedAmount - order.amount));
  }

  const footerY = Math.min(Math.max(y + 9, 252), 266);
  pdf.setDrawColor(225, 230, 237);
  pdf.line(margin, footerY, right, footerY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(104, 116, 132);
  pdf.text(
    pdf.splitTextToSize(
      "Keep this receipt for your records. For held payments, funds are released to the giver only after the receiver confirms delivery.",
      pageWidth - margin * 2,
    ),
    margin,
    footerY + 7,
  );
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(24, 67, 130);
  pdf.text("DoingGood", margin, 289);

  return pdf;
}

export function downloadPaymentReceipt(order: OrderHistoryEntry) {
  const pdf = createPaymentReceiptPdf(order);
  const safeReference = order.reference.replace(/[^a-zA-Z0-9-]/g, "-");
  pdf.save(`doinggood-receipt-${safeReference}.pdf`);
}
