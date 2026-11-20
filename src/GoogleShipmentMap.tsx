import { useEffect, useRef, useState } from "react";
import { shipmentProgress, type Shipment } from "./shipments";

declare global {
  interface Window {
    google?: typeof google;
    prestigeMapsReady?: () => void;
  }
}

type Props = {
  shipments: Shipment[];
  selectedId?: string;
  onSelect?: (shipmentId: string) => void;
  className?: string;
};

type MapEntry = {
  shipment: Shipment;
  marker: google.maps.marker.AdvancedMarkerElement;
  line: google.maps.Polyline;
};

let mapsReady: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.reject(new Error("Add VITE_GOOGLE_MAPS_API_KEY to .env.local to enable live maps."));
  if (typeof window.google?.maps?.importLibrary === "function") return Promise.resolve();
  if (mapsReady) return mapsReady;

  mapsReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    window.prestigeMapsReady = () => {
      delete window.prestigeMapsReady;
      resolve();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=prestigeMapsReady`;
    script.onerror = () => {
      delete window.prestigeMapsReady;
      mapsReady = null;
      reject(new Error("Google Maps could not be loaded. Check the key, API access, and network connection."));
    };
    document.head.appendChild(script);
  });
  return mapsReady;
}

function positionAlongRoute(path: google.maps.LatLng[], progress: number): google.maps.LatLng {
  const routeLength = google.maps.geometry.spherical.computeLength(path);
  if (routeLength <= 0 || progress >= 1) return path[path.length - 1];

  let distanceLeft = routeLength * Math.max(0, progress);
  for (let index = 1; index < path.length; index += 1) {
    const segmentLength = google.maps.geometry.spherical.computeDistanceBetween(path[index - 1], path[index]);
    if (distanceLeft <= segmentLength) {
      return google.maps.geometry.spherical.interpolate(path[index - 1], path[index], distanceLeft / segmentLength);
    }
    distanceLeft -= segmentLength;
  }
  return path[path.length - 1];
}

function markerColor(status: Shipment["status"]): string {
  if (status === "Delivered") return "#37a879";
  if (status === "On hold" || status === "Pending") return "#a0a2af";
  if (status === "Delayed") return "#e08a50";
  return "#6558d3";
}

export default function GoogleShipmentMap({ shipments, selectedId, onSelect, className = "" }: Props) {
  const mapElement = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let disposed = false;
    let animationTimer = 0;
    setMapError("");

    void loadGoogleMaps().then(async () => {
      if (disposed || !mapElement.current) return;
      const maps = window.google?.maps;
      if (!maps || typeof maps.importLibrary !== "function") {
        throw new Error("Google Maps loaded without its library loader. Check the Maps JavaScript API configuration.");
      }
      const [mapsLibrary, markerLibrary] = await Promise.all([
        maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
        maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
        maps.importLibrary("geometry"),
      ]);
      const { Map: GoogleMap } = mapsLibrary;
      const { AdvancedMarkerElement, PinElement } = markerLibrary;
      const map = new GoogleMap(mapElement.current, {
        center: { lat: 32, lng: -35 },
        mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        zoom: 2,
        minZoom: 2,
        maxZoom: 15,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        backgroundColor: "#eaf0f6",
      });
      const bounds = new maps.LatLngBounds();
      const entries: MapEntry[] = shipments.map((shipment) => {
        const path = [shipment.origin, shipment.destination].map((point) => new maps.LatLng(point.lat, point.lng));
        bounds.extend(path[0]);
        bounds.extend(path[1]);
        const color = markerColor(shipment.status);
        const line = new maps.Polyline({
          path,
          map,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: shipment.status === "On hold" || shipment.status === "Pending" ? 0.45 : 0.78,
          strokeWeight: shipment.id === selectedId ? 4 : 2,
        });
        const pin = new PinElement({
          background: color,
          borderColor: "#ffffff",
          glyphColor: "#ffffff",
          scale: shipment.id === selectedId ? 1.1 : 0.9,
        });
        const marker = new AdvancedMarkerElement({
          map,
          title: `${shipment.id} · ${shipment.status}`,
          position: shipment.origin,
          content: pin,
          zIndex: shipment.id === selectedId ? 10 : 1,
        });
        marker.addEventListener("gmp-click", () => onSelectRef.current?.(shipment.id));
        return { shipment, marker, line };
      });

      if (shipments.length > 1) map.fitBounds(bounds, 40);
      else if (shipments.length === 1) {
        const shipment = shipments[0];
        map.fitBounds(bounds, 60);
        map.panTo(positionAlongRoute(
          [new maps.LatLng(shipment.origin.lat, shipment.origin.lng), new maps.LatLng(shipment.destination.lat, shipment.destination.lng)],
          shipmentProgress(shipment),
        ));
      }

      const updatePositions = () => {
        const now = Date.now();
        entries.forEach(({ shipment, marker }) => {
          const progress = shipmentProgress(shipment, now);
          const origin = new maps.LatLng(shipment.origin.lat, shipment.origin.lng);
          const destination = new maps.LatLng(shipment.destination.lat, shipment.destination.lng);
          const position = shipment.status === "Delivered"
            ? destination
            : positionAlongRoute([origin, destination], progress);
          marker.position = position;
        });
      };

      updatePositions();
      animationTimer = window.setInterval(updatePositions, 1000);
    }).catch((error: unknown) => {
      if (disposed) return;
      const message = error instanceof Error ? error.message : "Google Maps failed to load.";
      console.error("Could not initialize the shipment map.", error);
      setMapError(message);
    });

    return () => {
      disposed = true;
      window.clearInterval(animationTimer);
    };
  }, [selectedId, shipments]);

  return (
    <div className={`google-map-frame ${className}`}>
      <div className="google-map-canvas" ref={mapElement} role="application" aria-label="Live shipment map" />
      {mapError && (
        <div className="map-error" role="alert">
          <strong>Map unavailable</strong>
          <span>{mapError}</span>
        </div>
      )}
      {!mapError && (
        <div className="map-live-badge"><i /> Live movement simulation</div>
      )}
    </div>
  );
}
