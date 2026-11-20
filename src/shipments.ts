import { supabase, supabaseConfigurationError } from "./supabase";
import type { Database } from "./database.types";

export type ShipmentStatus = "In transit" | "Delivered" | "Pending" | "Delayed" | "On hold";
export type ShipmentMode = "Road freight" | "Ocean freight" | "Air freight";

export type Coordinate = {
  lat: number;
  lng: number;
};

export type Shipment = {
  /** Database row id (uuid). Empty for the public tracking view. */
  dbId: string;
  /** Tracking number shown to customers, e.g. PFC-7KQ4-M29X. */
  id: string;
  recipient: string;
  initials: string;
  route: string;
  originName: string;
  destinationName: string;
  origin: Coordinate;
  destination: Coordinate;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  recipientEmail: string;
  recipientPhone: string;
  senderAddress: string;
  recipientAddress: string;
  shipDate: string;
  weightKg: number;
  pieceType: string;
  packageDescription: string;
  mode: ShipmentMode;
  date: string;
  status: ShipmentStatus;
  progress: number;
  startedAt: number | null;
};

export const CITY_OPTIONS: { name: string; position: Coordinate }[] = [
  { name: "Newark, US", position: { lat: 40.6895, lng: -74.1745 } },
  { name: "Rotterdam, NL", position: { lat: 51.9225, lng: 4.4792 } },
  { name: "Los Angeles, US", position: { lat: 33.7405, lng: -118.272 } },
  { name: "Chicago, US", position: { lat: 41.8781, lng: -87.6298 } },
  { name: "London, UK", position: { lat: 51.47, lng: -0.4543 } },
  { name: "Toronto, CA", position: { lat: 43.6777, lng: -79.6248 } },
  { name: "Houston, US", position: { lat: 29.755, lng: -95.354 } },
  { name: "Miami, US", position: { lat: 25.7959, lng: -80.287 } },
  { name: "New York, US", position: { lat: 40.6413, lng: -73.7781 } },
  { name: "Dublin, IE", position: { lat: 53.4264, lng: -6.2499 } },
];

export const SPEED_KMH: Record<ShipmentMode, number> = {
  "Road freight": 60,
  "Ocean freight": 35,
  "Air freight": 800,
};

export function distanceInKm(from: Coordinate, to: Coordinate): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(to.lat - from.lat);
  const lngDelta = radians(to.lng - from.lng);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function shipmentProgress(shipment: Shipment, now = Date.now()): number {
  if (shipment.status === "Delivered") return 1;
  if (shipment.status !== "In transit" || shipment.startedAt === null) return shipment.progress;

  const durationMs = distanceInKm(shipment.origin, shipment.destination) / SPEED_KMH[shipment.mode] * 3_600_000;
  return Math.min(1, shipment.progress + Math.max(0, now - shipment.startedAt) / durationMs);
}

type ShipmentRow = Database["public"]["Tables"]["shipments"]["Row"];
type TrackedRow = Database["public"]["Functions"]["track_shipment"]["Returns"][number];

function initialsFor(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function toShipment(row: TrackedRow | ShipmentRow, dbId = ""): Shipment {
  const details = "sender_name" in row ? row : null;
  return {
    dbId,
    id: row.tracking_number,
    recipient: row.recipient_name,
    initials: initialsFor(row.recipient_name),
    route: `${row.origin_name} → ${row.destination_name}`,
    originName: row.origin_name,
    destinationName: row.destination_name,
    origin: { lat: row.origin_lat, lng: row.origin_lng },
    destination: { lat: row.destination_lat, lng: row.destination_lng },
    senderName: details?.sender_name ?? "",
    senderEmail: details?.sender_email ?? "",
    senderPhone: details?.sender_phone ?? "",
    recipientEmail: details?.recipient_email ?? "",
    recipientPhone: details?.recipient_phone ?? "",
    senderAddress: details?.sender_address ?? "",
    recipientAddress: details?.recipient_address ?? "",
    shipDate: details?.ship_date ?? "",
    weightKg: details?.weight_kg ?? 0,
    pieceType: details?.piece_type ?? "",
    packageDescription: details?.package_description ?? "",
    mode: row.mode as ShipmentMode,
    date: formatDate(row.estimated_delivery),
    status: row.status as ShipmentStatus,
    progress: Number(row.progress),
    startedAt: row.started_at ? Date.parse(row.started_at) : null,
  };
}

function requireClient() {
  if (!supabase) throw new Error(supabaseConfigurationError);
  return supabase;
}

/** Admin only: every shipment, newest first (enforced by row level security). */
export async function fetchShipments(): Promise<Shipment[]> {
  const { data, error } = await requireClient()
    .from("shipments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => toShipment(row, row.id));
}

/** Customer only: shipments assigned to the signed-in, verified account. */
export async function fetchCustomerShipments(userId: string): Promise<Shipment[]> {
  const client = requireClient();
  const { error: claimError } = await client.rpc("claim_customer_shipments");
  if (claimError) throw claimError;

  const { data, error } = await client
    .from("shipments")
    .select("*")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => toShipment(row, row.id));
}

/** Public: look up a single shipment by tracking number. */
export async function trackShipment(trackingNumber: string): Promise<Shipment | null> {
  const { data, error } = await requireClient().rpc("track_shipment", { p_tracking_number: trackingNumber });
  if (error) throw error;
  return data[0] ? toShipment(data[0]) : null;
}

export async function createShipment(input: {
  recipient: string;
  recipientEmail: string;
  origin: { name: string; position: Coordinate };
  destination: { name: string; position: Coordinate };
  mode: ShipmentMode;
  estimatedDelivery: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  recipientPhone: string;
  weightKg: number;
  status: ShipmentStatus;
  shipDate: string;
  expectedDeliveryTime: string | null;
  pieceType: string;
  senderAddress: string;
  recipientAddress: string;
  packageDescription: string;
}): Promise<Shipment> {
  const { data, error } = await requireClient()
    .from("shipments")
    .insert({
      recipient_name: input.recipient,
      recipient_email: input.recipientEmail,
      sender_name: input.senderName,
      sender_email: input.senderEmail,
      sender_phone: input.senderPhone,
      recipient_phone: input.recipientPhone,
      origin_name: input.origin.name,
      destination_name: input.destination.name,
      origin_lat: input.origin.position.lat,
      origin_lng: input.origin.position.lng,
      destination_lat: input.destination.position.lat,
      destination_lng: input.destination.position.lng,
      mode: input.mode,
      status: input.status,
      progress: input.status === "Delivered" ? 1 : 0,
      started_at: input.status === "In transit" ? new Date().toISOString() : null,
      weight_kg: input.weightKg,
      ship_date: input.shipDate,
      estimated_delivery: input.estimatedDelivery,
      expected_delivery_time: input.expectedDeliveryTime,
      piece_type: input.pieceType,
      sender_address: input.senderAddress,
      recipient_address: input.recipientAddress,
      package_description: input.packageDescription,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toShipment(data, data.id);
}

export async function updateShipmentStatus(dbId: string, status: ShipmentStatus): Promise<void> {
  const { error } = await requireClient().rpc("set_shipment_status", { p_shipment_id: dbId, p_status: status });
  if (error) throw error;
}
