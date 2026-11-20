import { useEffect, useState, type FormEvent } from "react";
import type { Shipment } from "./shipments";

const currencies = ["USD", "EUR", "GBP", "CAD", "GHS"];

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function newInvoiceNumber(): string {
  const timestamp = Date.now().toString(36).slice(-5).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${new Date().getFullYear()}-${timestamp}${random}`;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export default function AdminInvoices({ shipments }: { shipments: Shipment[] }) {
  const [shipmentId, setShipmentId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState(newInvoiceNumber);
  const [currency, setCurrency] = useState("USD");
  const [issuedOn, setIssuedOn] = useState(() => localDateValue(new Date()));
  const [dueOn, setDueOn] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return localDateValue(date);
  });
  const [subtotal, setSubtotal] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!shipments.length) {
      setShipmentId("");
      return;
    }
    setShipmentId((current) => shipments.some((shipment) => shipment.dbId === current)
      ? current
      : shipments[0].dbId);
  }, [shipments]);

  const shipment = shipments.find((item) => item.dbId === shipmentId);
  const subtotalValue = Number(subtotal);
  const taxRateValue = Number(taxRate);
  const taxAmount = subtotalValue * taxRateValue / 100;
  const total = subtotalValue + taxAmount;

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shipment) {
      setError("Select a shipment before creating an invoice.");
      return;
    }
    if (!Number.isFinite(subtotalValue) || subtotalValue <= 0) {
      setError("Enter an invoice amount greater than zero.");
      return;
    }
    if (!Number.isFinite(taxRateValue) || taxRateValue < 0 || taxRateValue > 100) {
      setError("Enter a tax rate between 0 and 100 percent.");
      return;
    }
    if (dueOn < issuedOn) {
      setError("The due date cannot be earlier than the issue date.");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const { downloadShipmentInvoice } = await import("./invoicePdf");
      await downloadShipmentInvoice(shipment, {
        invoiceNumber,
        currency,
        issuedOn,
        dueOn,
        subtotal: subtotalValue,
        taxRate: taxRateValue,
      });
    } catch (generationError) {
      console.error("Could not generate invoice PDF", generationError);
      setError("Couldn't generate the invoice PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="panel-card invoice-builder">
      <div className="panel-heading">
        <div>
          <h2>Create a shipment invoice</h2>
          <p>Prepare a professional PDF invoice with a QR code that opens shipment tracking.</p>
        </div>
      </div>
      {!shipments.length ? <div className="invoice-empty-state">
        <h3>No shipments to invoice yet</h3>
        <p>Create a shipment first, then return here to prepare its invoice.</p>
      </div> : <form className="invoice-form" onSubmit={(event) => void createInvoice(event)}>
        <div className="invoice-form-grid">
          <label>Shipment *
            <select required value={shipmentId} onChange={(event) => setShipmentId(event.target.value)}>
              {shipments.map((item) => <option key={item.dbId} value={item.dbId}>{item.id} · {item.recipient} · {item.route}</option>)}
            </select>
          </label>
          <label>Invoice number
            <input value={invoiceNumber} readOnly />
          </label>
          <label>Issue date *
            <input type="date" required value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} />
          </label>
          <label>Due date *
            <input type="date" required value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
          </label>
          <label>Subtotal *
            <input type="number" min="0.01" step="0.01" required value={subtotal} onChange={(event) => setSubtotal(event.target.value)} placeholder="0.00" />
          </label>
          <label>Currency *
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {currencies.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Tax rate (%)
            <input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} />
          </label>
        </div>

        {shipment && <div className="invoice-shipment-summary">
          <div><span>Bill to</span><strong>{shipment.recipient}</strong>{shipment.recipientEmail && <small>{shipment.recipientEmail}</small>}</div>
          <div><span>Shipment route</span><strong>{shipment.originName} → {shipment.destinationName}</strong><small>{shipment.mode} · {shipment.id}</small></div>
        </div>}

        <div className="invoice-total-preview">
          <span>Invoice total</span>
          <strong>{formatMoney(Number.isFinite(total) ? total : 0, currency)}</strong>
          <small>Tax: {formatMoney(Number.isFinite(taxAmount) ? taxAmount : 0, currency)}</small>
        </div>
        {error && <p className="admin-auth-error" role="alert">{error}</p>}
        <div className="invoice-form-actions">
          <button className="button-secondary" type="button" onClick={() => setInvoiceNumber(newInvoiceNumber())}>Generate new invoice number</button>
          <button className="button-primary" type="submit" disabled={generating || !shipment}>
            {generating ? "Preparing PDF…" : "Download Invoice PDF"}
          </button>
        </div>
      </form>}
    </section>
  );
}
