import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { Shipment, ShipmentInvoice } from "./shipments";

export type ShipmentInvoiceDetails = ShipmentInvoice;

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
  const subtotal = details.subtotal;
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
  doc.text("SHIP FROM", 112, 86);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(25, 34, 48);
  addParagraph(doc, shipment.recipient, margin, 94, 82, 4, 1);
  addParagraph(doc, shipment.senderName || "—", 112, 94, 78, 4, 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(76, 84, 96);
  if (shipment.recipientEmail) addParagraph(doc, shipment.recipientEmail, margin, 101, 82, 4, 1);
  if (shipment.recipientPhone) addParagraph(doc, shipment.recipientPhone, margin, 106, 82, 4, 1);
  if (shipment.recipientAddress) addParagraph(doc, shipment.recipientAddress, margin, 111, 82, 4, 3);
  if (shipment.senderEmail) addParagraph(doc, shipment.senderEmail, 112, 101, 78, 4, 1);
  if (shipment.senderPhone) addParagraph(doc, shipment.senderPhone, 112, 106, 78, 4, 1);
  if (shipment.senderAddress) addParagraph(doc, shipment.senderAddress, 112, 111, 78, 4, 3);

  doc.setDrawColor(224, 228, 234);
  doc.line(margin, 127, rightEdge, 127);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(98, 108, 121);
  doc.text("SHIPMENT DETAILS", margin, 136);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(76, 84, 96);
  addParagraph(doc, `Route: ${shipment.originName} to ${shipment.destinationName}`, margin, 142, 174, 4, 1);
  doc.text(`Service: ${shipment.mode}   Ship date: ${invoiceDate(shipment.shipDate)}   Estimated delivery: ${shipment.date}`, margin, 148);

  doc.setDrawColor(224, 228, 234);
  doc.line(margin, 153, rightEdge, 153);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, 158, pageWidth - margin * 2, 11, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(66, 75, 88);
  doc.text("DESCRIPTION", margin + 4, 165);
  doc.text("AMOUNT", rightEdge - 4, 165, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 48, 61);
  addParagraph(doc, description, margin + 4, 177, 125);
  doc.text(subtotal === null || !details.currency
    ? "Amount not provided"
    : formatMoney(subtotal, details.currency), rightEdge - 4, 177, { align: "right" });
  doc.setDrawColor(224, 228, 234);
  doc.line(margin, 189, rightEdge, 189);

  const totalX = 134;
  if (subtotal === null || !details.currency) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(76, 84, 96);
    doc.text("Amount not provided", totalX, 202);
  } else {
    const taxAmount = subtotal * details.taxRate / 100;
    const total = subtotal + taxAmount;
    doc.setFontSize(9);
    doc.setTextColor(76, 84, 96);
    doc.text("Subtotal", totalX, 198);
    doc.text(formatMoney(subtotal, details.currency), rightEdge, 198, { align: "right" });
    if (details.taxRate > 0) {
      doc.text(`Tax (${details.taxRate.toFixed(2)}%)`, totalX, 206);
      doc.text(formatMoney(taxAmount!, details.currency), rightEdge, 206, { align: "right" });
    }
    doc.setDrawColor(224, 228, 234);
    doc.line(totalX, details.taxRate > 0 ? 211 : 204, rightEdge, details.taxRate > 0 ? 211 : 204);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(16, 32, 51);
    doc.text("Total due", totalX, details.taxRate > 0 ? 220 : 213);
    doc.text(formatMoney(total, details.currency), rightEdge, details.taxRate > 0 ? 220 : 213, { align: "right" });
  }

  doc.addImage(qrCode, "PNG", margin, 225, 34, 34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(25, 34, 48);
  doc.text("Scan to track this shipment", 58, 234);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(98, 108, 121);
  addParagraph(doc, "Use your phone camera to open the secure shipment tracking page.", 58, 241, 100, 4);

  doc.setDrawColor(224, 228, 234);
  doc.line(margin, 269, rightEdge, 269);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(115, 123, 135);
  doc.text("Copyright 2024 Prestige Freight Cargo - Thank you for your business.", margin, 277);
  doc.text("info@prestigefreightcargo.com", rightEdge, 277, { align: "right" });

  doc.save(`invoice-${details.invoiceNumber}.pdf`);
}
