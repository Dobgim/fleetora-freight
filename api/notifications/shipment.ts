import { createClient } from "@supabase/supabase-js";
import { createTransport } from "nodemailer";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Database } from "../../src/database.types";

type Request = IncomingMessage & { body?: unknown };
type Response = ServerResponse<IncomingMessage> & {
  status: (code: number) => Response;
  json: (body: unknown) => void;
};

type ShipmentEvent = "created" | "updated";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function respond(response: Response, status: number, body: unknown): void {
  response.status(status).json(body);
}

export default async function handler(request: Request, response: Response): Promise<void> {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, { error: "Method not allowed." });
    return;
  }

  const authorization = request.headers.authorization;
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) {
    respond(response, 401, { error: "Administrator sign-in is required." });
    return;
  }

  const body = request.body;
  if (!isRecord(body)
    || typeof body.shipmentId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.shipmentId)
    || (body.event !== "created" && body.event !== "updated")) {
    respond(response, 400, { error: "Invalid shipment notification request." });
    return;
  }
  const event: ShipmentEvent = body.event;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    respond(response, 500, { error: "The shipment email service is not configured with Supabase." });
    return;
  }

  const client = createClient<Database>(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } = await client.auth.getUser(accessToken);
  if (userError || !userData.user) {
    respond(response, 401, { error: "Administrator sign-in is required." });
    return;
  }

  const { data: isAdmin, error: roleError } = await client.rpc("is_admin");
  if (roleError) {
    console.error("Could not verify shipment notification permissions", roleError);
    respond(response, 500, { error: "Could not verify administrator permissions." });
    return;
  }
  if (!isAdmin) {
    respond(response, 403, { error: "Administrator access is required." });
    return;
  }

  const { data: shipment, error: shipmentError } = await client
    .from("shipments")
    .select("tracking_number, sender_email, recipient_email, origin_name, destination_name, status, estimated_delivery")
    .eq("id", body.shipmentId)
    .single();
  if (shipmentError?.code === "PGRST116") {
    respond(response, 404, { error: "The shipment could not be found." });
    return;
  }
  if (shipmentError || !shipment) {
    console.error("Could not load shipment for email notification", shipmentError);
    respond(response, 500, { error: "Could not load shipment details for email notification." });
    return;
  }

  const senderEmail = shipment.sender_email.trim();
  const recipientEmail = shipment.recipient_email.trim();
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!isValidEmail(senderEmail) || !isValidEmail(recipientEmail)) {
    respond(response, 400, { error: "Valid sender and receiver email addresses are required." });
    return;
  }
  const recipients = [...new Set([senderEmail, recipientEmail])];

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !Number.isInteger(port) || port <= 0 || !user || !password || !from) {
    respond(response, 500, { error: "Hostinger SMTP settings are incomplete." });
    return;
  }

  const eventLabel = event === "created" ? "created" : "updated";
  const subject = `Shipment ${eventLabel}: ${shipment.tracking_number}`;
  const shipmentUrl = process.env.PUBLIC_SITE_URL?.replace(/\/+$/, "");
  const trackingLink = shipmentUrl
    ? `${shipmentUrl}/track?code=${encodeURIComponent(shipment.tracking_number)}`
    : null;
  const text = [
    `Hello,`,
    ``,
    `A shipment ${eventLabel} by Prestige Freight Cargo.`,
    `Tracking number: ${shipment.tracking_number}`,
    `Status: ${shipment.status}`,
    `Route: ${shipment.origin_name} to ${shipment.destination_name}`,
    `Estimated delivery: ${shipment.estimated_delivery}`,
    ...(trackingLink ? [`Track this shipment: ${trackingLink}`] : []),
  ].join("\n");
  const html = `<p>Hello,</p><p>A shipment was ${eventLabel} by Prestige Freight Cargo.</p><ul><li><strong>Tracking number:</strong> ${escapeHtml(shipment.tracking_number)}</li><li><strong>Status:</strong> ${escapeHtml(shipment.status)}</li><li><strong>Route:</strong> ${escapeHtml(shipment.origin_name)} to ${escapeHtml(shipment.destination_name)}</li><li><strong>Estimated delivery:</strong> ${escapeHtml(shipment.estimated_delivery)}</li></ul>${trackingLink ? `<p><a href="${escapeHtml(trackingLink)}">Track this shipment</a></p>` : ""}`;
  const transporter = createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });

  try {
    await Promise.all(recipients.map((to) => transporter.sendMail({ from, to, subject, text, html })));
  } catch (error) {
    console.error("Could not send shipment notification email", error);
    respond(response, 502, { error: "The shipment was saved, but an email could not be sent. Check the SMTP settings and try again." });
    return;
  }

  respond(response, 200, { sent: recipients.length });
}
