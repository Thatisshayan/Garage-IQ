// Browser-only invoice PDF generator using jsPDF.
import { jsPDF } from "jspdf";

type InvoiceData = {
  jobId: string;
  jobDescription: string | null;
  customer: { name: string; phone?: string | null; email?: string | null; address?: string | null };
  vehicle: { year?: number | null; make?: string | null; model?: string | null; vin?: string | null; license_plate?: string | null };
  totalOwed?: number | null;
  payments: Array<{ paid_at: string; payer_type: string; payer_name?: string | null; amount: number; method?: string | null; note?: string | null }>;
  reportedProblem?: string | null;
  odometer?: number | null;
  currency?: string;
};

export function generateInvoicePdf(data: InvoiceData) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48; // margin
  let y = M;
  const currency = data.currency || "CAD";

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("WORKSHOP INVOICE", M, y);
  y += 8;
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Job ID: ${data.jobId.slice(0, 8)}`, M, y);
  doc.text(`Date: ${new Date().toLocaleDateString("en-CA")}`, W - M, y, { align: "right" });
  y += 24;

  // Customer + vehicle two columns
  doc.setTextColor(20);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", M, y);
  doc.text("VEHICLE", W / 2, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(data.customer.name, M, y);
  const vehLine = [data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(" ") || "—";
  doc.text(vehLine, W / 2, y);
  y += 14;
  if (data.customer.phone) { doc.text(data.customer.phone, M, y); }
  if (data.vehicle.license_plate) doc.text(`Plate: ${data.vehicle.license_plate}`, W / 2, y);
  y += 14;
  if (data.customer.email) doc.text(data.customer.email, M, y);
  if (data.vehicle.vin) doc.text(`VIN: ${data.vehicle.vin}`, W / 2, y);
  y += 14;
  if (data.customer.address) { doc.text(data.customer.address, M, y); }
  if (data.odometer) doc.text(`Odometer: ${data.odometer} km`, W / 2, y);
  y += 28;

  // Description
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("WORK PERFORMED", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const desc = data.jobDescription || data.reportedProblem || "—";
  const lines = doc.splitTextToSize(desc, W - M * 2);
  doc.text(lines, M, y);
  y += lines.length * 14 + 18;

  // Payment ledger
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PAYMENT LEDGER", M, y);
  y += 4;
  doc.setDrawColor(220);
  doc.line(M, y, W - M, y);
  y += 14;

  doc.setFontSize(8);
  doc.text("DATE", M, y);
  doc.text("PAYER", M + 90, y);
  doc.text("METHOD", M + 240, y);
  doc.text("AMOUNT", W - M, y, { align: "right" });
  y += 12;
  doc.setDrawColor(240);
  doc.line(M, y, W - M, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (data.payments.length === 0) {
    doc.setTextColor(140);
    doc.text("No payments recorded yet.", M, y);
    doc.setTextColor(20);
    y += 14;
  } else {
    for (const p of data.payments) {
      doc.text(new Date(p.paid_at).toLocaleDateString("en-CA"), M, y);
      doc.text(`${p.payer_type.toUpperCase()}${p.payer_name ? " · " + p.payer_name : ""}`, M + 90, y);
      doc.text(p.method || "—", M + 240, y);
      doc.text(`${currency} ${Number(p.amount).toFixed(2)}`, W - M, y, { align: "right" });
      y += 14;
      if (y > 720) { doc.addPage(); y = M; }
    }
  }

  // Totals
  y += 8;
  doc.setDrawColor(200);
  doc.line(M, y, W - M, y);
  y += 18;

  const totalPaid = data.payments.reduce((s, p) => s + Number(p.amount), 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (data.totalOwed != null) {
    doc.text("Total quoted", W - M - 140, y);
    doc.text(`${currency} ${data.totalOwed.toFixed(2)}`, W - M, y, { align: "right" });
    y += 16;
  }
  doc.text("Total paid", W - M - 140, y);
  doc.text(`${currency} ${totalPaid.toFixed(2)}`, W - M, y, { align: "right" });
  y += 16;

  if (data.totalOwed != null) {
    const outstanding = data.totalOwed - totalPaid;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(outstanding > 0 ? 200 : 30, outstanding > 0 ? 80 : 130, 30);
    doc.text("BALANCE DUE", W - M - 140, y);
    doc.text(`${currency} ${outstanding.toFixed(2)}`, W - M, y, { align: "right" });
    doc.setTextColor(20);
  }

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text("Thank you for your business.", M, doc.internal.pageSize.getHeight() - 32);

  doc.save(`invoice-${data.jobId.slice(0, 8)}.pdf`);
}
