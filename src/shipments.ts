export type ShipmentStatus = "In transit" | "Delivered" | "Pending" | "Delayed" | "On hold";
export type ShipmentMode = "Road freight" | "Ocean freight" | "Air freight";

export type Coordinate = {
  lat: number;
  lng: number;
};

export type Shipment = {
  id: string;
  recipient: string;
  initials: string;
  route: string;
  originName: string;
  destinationName: string;
  origin: Coordinate;
  destination: Coordinate;
  mode: ShipmentMode;
  date: string;
  status: ShipmentStatus;
  progress: number;
  startedAt: number | null;
};

export const STORAGE_KEY = "fleetora.shipments.v1";

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

function demoShipment(
  shipment: Omit<Shipment, "progress" | "startedAt">,
  progress: number,
): Shipment {
  return {
    ...shipment,
    progress,
    startedAt: shipment.status === "In transit" ? Date.now() : null,
  };
}

export const initialShipments: Shipment[] = [
  demoShipment({ id: "FLE-7KQ4-M29X", recipient: "Northstar Furniture", initials: "NF", route: "Newark, US → Rotterdam, NL", originName: "Newark, US", destinationName: "Rotterdam, NL", origin: CITY_OPTIONS[0].position, destination: CITY_OPTIONS[1].position, mode: "Ocean freight", date: "Nov 23, 2026", status: "In transit" }, 0.34),
  demoShipment({ id: "FLE-2XP8-B14C", recipient: "Marlow & Finch", initials: "MF", route: "Los Angeles, US → Chicago, US", originName: "Los Angeles, US", destinationName: "Chicago, US", origin: CITY_OPTIONS[2].position, destination: CITY_OPTIONS[3].position, mode: "Road freight", date: "Nov 22, 2026", status: "In transit" }, 0.42),
  demoShipment({ id: "FLE-9LD3-Q61A", recipient: "Goodwell Market", initials: "GM", route: "London, UK → Toronto, CA", originName: "London, UK", destinationName: "Toronto, CA", origin: CITY_OPTIONS[4].position, destination: CITY_OPTIONS[5].position, mode: "Air freight", date: "Nov 21, 2026", status: "Delivered" }, 1),
  demoShipment({ id: "FLE-4HT6-W82N", recipient: "Aster Home", initials: "AH", route: "Houston, US → Miami, US", originName: "Houston, US", destinationName: "Miami, US", origin: CITY_OPTIONS[6].position, destination: CITY_OPTIONS[7].position, mode: "Road freight", date: "Nov 24, 2026", status: "On hold" }, 0.18),
  demoShipment({ id: "FLE-5ZM1-R73P", recipient: "Paw & Co.", initials: "PC", route: "New York, US → Dublin, IE", originName: "New York, US", destinationName: "Dublin, IE", origin: CITY_OPTIONS[8].position, destination: CITY_OPTIONS[9].position, mode: "Air freight", date: "Nov 25, 2026", status: "Delayed" }, 0.56),
];

function isShipment(value: unknown): value is Shipment {
  if (typeof value !== "object" || value === null) return false;
  const shipment = value as Partial<Shipment>;
  return typeof shipment.id === "string"
    && typeof shipment.recipient === "string"
    && typeof shipment.route === "string"
    && typeof shipment.originName === "string"
    && typeof shipment.destinationName === "string"
    && typeof shipment.origin?.lat === "number"
    && typeof shipment.origin?.lng === "number"
    && typeof shipment.destination?.lat === "number"
    && typeof shipment.destination?.lng === "number"
    && (shipment.mode === "Road freight" || shipment.mode === "Ocean freight" || shipment.mode === "Air freight")
    && (shipment.status === "In transit" || shipment.status === "Delivered" || shipment.status === "Pending" || shipment.status === "Delayed" || shipment.status === "On hold")
    && typeof shipment.progress === "number"
    && (typeof shipment.startedAt === "number" || shipment.startedAt === null);
}

export function readShipments(): Shipment[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return initialShipments;
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.every(isShipment)) return parsed;
    console.error("Saved shipment data is invalid; showing the demo shipments instead.");
  } catch (error) {
    console.error("Could not read saved shipment data; showing the demo shipments instead.", error);
  }
  return initialShipments;
}

export function saveShipments(shipments: Shipment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shipments));
  } catch (error) {
    console.error("Could not save shipment changes in this browser.", error);
  }
}
