import { useEffect, useMemo, useState, type FormEvent } from "react";
import GoogleShipmentMap from "./GoogleShipmentMap";
import {
  shipmentProgress,
  SPEED_KMH,
  trackShipment,
  type Shipment,
} from "./shipments";

function trackingCodeFromUrl(): string {
  return new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase() ?? "";
}

const REFRESH_MS = 30_000;

export default function ClientTracking() {
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [trackingCode, setTrackingCode] = useState(trackingCodeFromUrl);
  const [query, setQuery] = useState(trackingCodeFromUrl);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!trackingCode) {
      setShipment(null);
      setLoadError("");
      return;
    }
    let active = true;
    async function load(showSpinner: boolean) {
      if (showSpinner) setLoading(true);
      try {
        const result = await trackShipment(trackingCode);
        if (!active) return;
        setShipment(result);
        setLoadError("");
      } catch (error) {
        if (!active) return;
        console.error("Could not load shipment", error);
        setLoadError("We couldn't reach the tracking service. Please try again in a moment.");
      } finally {
        if (active && showSpinner) setLoading(false);
      }
    }
    void load(true);
    const refresh = window.setInterval(() => void load(false), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, [trackingCode]);

  const mappedShipments = useMemo(() => shipment ? [shipment] : [], [shipment]);
  const progress = shipment ? shipmentProgress(shipment, now) : 0;
  const speed = shipment ? SPEED_KMH[shipment.mode] : 0;
  const isMoving = shipment?.status === "In transit";

  function searchShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = query.trim().toUpperCase();
    setTrackingCode(code);
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("code", code); else url.searchParams.delete("code");
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="client-tracking">
      <header className="tracking-header">
        <a href="/" className="tracking-brand"><img src="/storage/brand/prestige-freight-cargo.svg" alt="Prestige Freight Cargo" /></a>
        <div className="tracking-header-actions"><a className="tracking-home-link" href="/">Freight, parcels & logistics <span>↗</span></a><a className="tracking-account-link" href="/account">Customer login</a></div>
      </header>
      <main className="tracking-content">
        <div className="tracking-intro">
          <span className="tracking-eyebrow"><i /> SHIPMENT TRACKING</span>
          <h1>Every mile, in view.</h1>
          <p>Get an estimated shipment location and the latest journey details for your Prestige Freight Cargo delivery.</p>
        </div>

        <form className="tracking-search-form" onSubmit={searchShipment}>
          <label htmlFor="client-tracking-code">Tracking number</label>
          <div><input id="client-tracking-code" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter your tracking number" /><button type="submit">Track shipment <span>→</span></button></div>
        </form>

        {shipment ? (
          <>
            <section className="client-shipment-summary">
              <div className="client-shipment-heading">
                <div><span className="client-code">{shipment.id}</span><h2>{shipment.recipient}</h2></div>
                <span className={`client-status ${shipment.status.toLowerCase().replace(" ", "-")}`}><i />{shipment.status}</span>
              </div>
              <div className="client-route-grid">
                <div><small>ORIGIN</small><b>{shipment.originName}</b></div>
                <span className="route-flight">→</span>
                <div><small>DESTINATION</small><b>{shipment.destinationName}</b></div>
                <div><small>SERVICE</small><b>{shipment.mode}</b></div>
                <div><small>ESTIMATED DELIVERY</small><b>{shipment.date}</b></div>
              </div>
              <div className="client-progress"><div><span>Journey progress</span><b>{Math.round(progress * 100)}%</b></div><i><span style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} /></i></div>
            </section>

            <section className="client-map-card">
              <div className="client-map-heading"><div><h2>Shipment location</h2><p>{isMoving ? `Estimated movement at ${speed.toLocaleString()} km/h` : shipment.status === "Delivered" ? "Package delivered to its destination" : "Package is stationary while its status is " + shipment.status.toLowerCase()}</p></div><span className={`map-pulse ${isMoving ? "moving" : ""}`}><i />{isMoving ? "MOVING · EST." : shipment.status.toUpperCase()}</span></div>
              <GoogleShipmentMap shipments={mappedShipments} selectedId={shipment.id} className="client-map" />
              <div className="simulation-note"><span>ⓘ</span> Position is estimated from the service speed and the latest status update from our operations team.</div>
            </section>

            <section className="tracking-timeline">
              <div className="timeline-title"><h2>Journey updates</h2><span>Tracking ID {shipment.id}</span></div>
              <div className="timeline-list">
                <div className={shipment.status === "Delivered" ? "complete" : isMoving ? "current" : ""}><i /><span><b>Delivered to destination</b><small>Final handoff and proof of delivery</small></span><time>{shipment.status === "Delivered" ? shipment.date : "Upcoming"}</time></div>
                <div className={isMoving ? "current" : ""}><i /><span><b>{shipment.status === "On hold" ? "Shipment on hold" : shipment.status === "Delayed" ? "Shipment delayed" : "In transit"}</b><small>{isMoving ? `${shipment.mode} · ${speed.toLocaleString()} km/h simulated speed` : shipment.status === "On hold" ? "Movement resumes when the shipment returns to In transit" : "Current shipment status"}</small></span><time>{isMoving ? "Now" : shipment.status}</time></div>
                <div className={progress > 0 ? "complete" : ""}><i /><span><b>Shipment booked</b><small>Order received and shipment details confirmed</small></span><time>{progress > 0 ? "Confirmed" : shipment.date}</time></div>
              </div>
            </section>
          </>
        ) : (
          <section className="tracking-not-found"><span>{loading ? "…" : "?"}</span><h2>{loading ? "Looking up your shipment" : loadError ? "Tracking is unavailable" : trackingCode ? "We couldn't find that shipment" : "Enter a tracking number"}</h2><p>{loading ? "One moment while we fetch the latest status." : loadError || (trackingCode ? "Check the number and try again. Tracking numbers look like PFC-7KQ4-M29X." : "Your tracking number is in your booking confirmation.")}</p></section>
        )}
      </main>
      <footer className="tracking-footer"><span>© 2026 Prestige Freight Cargo</span><a href="mailto:info@prestigefreightcargo.com">Need help? Contact our team</a></footer>
    </div>
  );
}
