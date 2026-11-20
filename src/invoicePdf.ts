import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { Shipment } from "./shipments";

export type ShipmentInvoiceDetails = {
  invoiceNumber: string;
  currency: string;
  issuedOn: string;
  dueOn: string;
  subtotal: number;
  taxRate: number;
};

function invoiceDate(date: string): string {
  if (!date) return "—";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function addParagraph(
  doc: jsPDF,
  value: string,
  x: number,
  y: number,
  width: number,
  lineHeight = 4,
  maxLines = 3,
): number {
  const allLines = doc.splitTextToSize(value || "-", width) as string[];
  const lines = allLines.slice(0, maxLines);
  if (allLines.length > maxLines) {
    const lastLineIndex = lines.length - 1;
    lines[lastLineIndex] = `${lines[lastLineIndex].slice(0, -3)}...`;
  }
  doc.text(lines, x, y);
  return lines.length * lineHeight;
}

export async function downloadShipmentInvoice(shipment: Shipment, details: ShipmentInvoiceDetails): Promise<void> {
  const trackingUrl = new URL("/track", window.location.origin);
  trackingUrl.searchParams.set("code", shipment.id);
  const qrCode = await QRCode.toDataURL(trackingUrl.toString(), {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 360,
    color: { dark: "#102033", light: "#FFFFFF" },
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = 210;
  const margin = 18;
  const rightEdge = pageWidth - margin;
  const taxAmount = details.subtotal * details.taxRate / 100;
  const total = details.subtotal + taxAmount;
  const description = shipment.packageDescription
    ? `${shipment.mode} - ${shipment.pieceType || "Freight"}\n${shipment.packageDescription.slice(0, 180)}`
    : `${shipment.mode} - ${shipment.pieceType || "Freight"}`;

  doc.setProperties({
    title: `Invoice ${details.invoiceNumber}`,
    subject: `Freight service for shipment ${shipment.id}`,
    author: "Prestige Freight Cargo",
    creator: "Prestige Freight Cargo Admin Dashboard",
  });

  doc.setFillColor(16, 32, 51);
  doc.rect(0, 0, pageWidth, 47, "F");
  doc.setFillColor(237, 167, 47);
  doc.rect(0, 46, pageWidth, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("PRESTIGE FREIGHT CARGO", margin, 21);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(217, 225, 235);
  doc.text("INTERNATIONAL FREIGHT & LOGISTICS", margin, 29);
  doc.text("info@prestigefreightcargo.com", margin, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", rightEdge, 22, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(217, 225, 235);
  doc.text(details.invoiceNumber, rightEdge, 31, { align: "right" });

  doc.setTextColor(63, 72, 85);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("ISSUED", margin, 61);
  doc.text("DUE DATE", 73, 61);
  doc.text("TRACKING ID", 128, 61);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(25, 34, 48);
  doc.text(invoiceDate(details.issuedOn), margin, 68);
  doc.text(invoiceDate(details.dueOn), 73, 68);
  doc.setFont("helvetica", "bold");
  doc.text(shipment.id, 128, 68);

  doc.setDrawColor(224, 228, 234);
  doc.line(margin, 76, rightEdge, 76);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(98, 108, 121);
  doc.text("BILL TO", margin, 86);
  doc.text("SHIPMENT DETAILS", 112, 86);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(25, 34, 48);
  doc.text(shipment.recipient, margin, 94);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(76, 84, 96);
  let billToY = 100;
  if (shipment.recipientEmail) billToY += addParagraph(doc, shipment.recipientEmail, margin, billToY, 82);
  if (shipment.recipientAddress) billToY += addParagraph(doc, shipment.recipientAddress, margin, billToY, 82);
  doc.setFontSize(8.5);
  doc.text(`Service: ${shipment.mode}`, 112, 94);
  addParagraph(doc, `Route: ${shipment.originName} to ${shipment.destinationName}`, 112, 100, 78, 4, 2);
  doc.text(`Ship date: ${invoiceDate(shipment.shipDate)}`, 112, 106);
  doc.text(`Estimated delivery: ${shipment.date}`, 112, 112);
  if (shipment.weightKg > 0) doc.text(`Weight: ${shipment.weightKg} kg`, 112, 118);
  if (shipment.senderName) doc.text(`Shipper: ${shipment.senderName}`, 112, 124);

  doc.setDrawColor(224, 228, 234);
  doc.line(margin, 128, rightEdge, 128);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, 137, pageWidth - margin * 2, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(66, 75, 88);
  doc.text("DESCRIPTION", margin + 4, 144);
  doc.text("AMOUNT", rightEdge - 4, 144, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 48, 61);
  addParagraph(doc, description, margin + 4, 157, 125);
  doc.text(formatMoney(details.subtotal, details.currency), rightEdge - 4, 157, { align: "right" });
  doc.setDrawColor(224, 228, 234);
  doc.line(margin, 170, rightEdge, 170);

  const totalX = 134;
  doc.setFontSize(9);
  doc.setTextColor(76, 84, 96);
  doc.text("Subtotal", totalX, 181);
  doc.text(formatMoney(details.subtotal, details.currency), rightEdge, 181, { align: "right" });
  doc.text(`Tax (${details.taxRate.toFixed(2)}%)`, totalX, 189);
  doc.text(formatMoney(taxAmount, details.currency), rightEdge, 189, { align: "right" });
  doc.setDrawColor(224, 228, 234);
  doc.line(totalX, 194, rightEdge, 194);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(16, 32, 51);
  doc.text("Total due", totalX, 203);
  doc.text(formatMoney(total, details.currency), rightEdge, 203, { align: "right" });

  doc.addImage(qrCode, "PNG", margin, 211, 37, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(25, 34, 48);
  doc.text("Scan to track this shipment", 62, 220);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(98, 108, 121);
  addParagraph(doc, "Use your phone camera to open the secure shipment tracking page.", 62, 227, 100, 4);

  doc.setDrawColor(224, 228, 234);
  doc.line(margin, 269, rightEdge, 269);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(115, 123, 135);
  doc.text("Copyright 2024 Prestige Freight Cargo - Thank you for your business.", margin, 277);
  doc.text("info@prestigefreightcargo.com", rightEdge, 277, { align: "right" });

  doc.save(`invoice-${details.invoiceNumber}.pdf`);
}
