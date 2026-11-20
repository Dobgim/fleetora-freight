import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import GoogleShipmentMap from "./GoogleShipmentMap";
import { supabase } from "./supabase";
import {
  CITY_OPTIONS,
  createShipment,
  fetchShipments,
  SPEED_KMH,
  updateShipmentStatus,
  type Shipment,
  type ShipmentMode,
  type ShipmentStatus,
} from "./shipments";

const navigation = [
  { label: "Overview", icon: "grid" },
  { label: "Shipments", icon: "box" },
  { label: "Tracking", icon: "pin" },
  { label: "Customers", icon: "users" },
  { label: "Invoices", icon: "receipt" },
  { label: "Analytics", icon: "chart" },
];

const titles: Record<string, string> = {
  Overview: "Overview",
  Shipments: "Shipments",
  Tracking: "Live tracking",
  Customers: "Customers",
  Invoices: "Invoices",
  Analytics: "Analytics",
  Settings: "Settings",
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.3 7.7 7.7 4.4 7.7-4.4M12 12v9" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    receipt: <><path d="M4 3h16v18l-3-2-3 2-3-2-3 2-4-2V3Z" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 3 6-7" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.5-.9l.3-1.8H16l.3 1.8a8 8 0 0 1 1.5.9l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1-.1 1.7Z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4 4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    down: <path d="m7 10 5 5 5-5" />,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></>,
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] ?? paths.grid}
    </svg>
  );
}

function DashboardIcon({ name }: { name: string }) {
  return <span className="dash-nav-icon"><Icon name={name} /></span>;
}

function defaultDeliveryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default function AdminDashboard({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const metadataName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const fullName = metadataName || (user.email ?? "Administrator").split("@")[0];
  const firstName = fullName.split(/\s+/)[0];
  const userInitials = fullName.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase();
  const [activePage, setActivePage] = useState("Overview");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newDeliveryDate, setNewDeliveryDate] = useState(defaultDeliveryDate);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All shipments");
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newRecipient, setNewRecipient] = useState("");
  const [newOrigin, setNewOrigin] = useState(CITY_OPTIONS[0].name);
  const [newDestination, setNewDestination] = useState(CITY_OPTIONS[1].name);
  const [newMode, setNewMode] = useState<ShipmentMode>("Ocean freight");

  useEffect(() => {
    if (!modalOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modalOpen]);

  const reloadShipments = useCallback(async () => {
    try {
      setShipments(await fetchShipments());
      setLoadError("");
    } catch (error) {
      console.error("Could not load shipments", error);
      setLoadError("Couldn't load shipments from the database. Check your connection and refresh.");
    }
  }, []);

  useEffect(() => {
    void reloadShipments();
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel("admin-shipments")
      .on("postgres_changes", { event: "*", schema: "public", table: "shipments" }, () => void reloadShipments())
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [reloadShipments]);

  const filteredShipments = useMemo(() => shipments.filter((shipment) => {
    const matchesSearch = `${shipment.id} ${shipment.recipient} ${shipment.route}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All shipments" || shipment.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [search, shipments, statusFilter]);

  async function addShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipient = newRecipient.trim();
    const origin = CITY_OPTIONS.find((city) => city.name === newOrigin);
    const destination = CITY_OPTIONS.find((city) => city.name === newDestination);
    if (!recipient || !origin || !destination) return;
    setSaving(true);
    setFormError("");
    try {
      const created = await createShipment({
        recipient,
        recipientEmail: newRecipientEmail.trim(),
        origin,
        destination,
        mode: newMode,
        estimatedDelivery: newDeliveryDate,
      });
      setShipments((current) => [created, ...current.filter((shipment) => shipment.dbId !== created.dbId)]);
      setNewRecipient("");
      setNewRecipientEmail("");
      setNewDeliveryDate(defaultDeliveryDate());
      setStatusFilter("All shipments");
      setSearch("");
      setActivePage("Shipments");
      setModalOpen(false);
    } catch (error) {
      console.error("Could not create shipment", error);
      setFormError("Couldn't save the shipment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changeShipmentStatus(shipment: Shipment, status: ShipmentStatus) {
    setStatusMenuId(null);
    if (shipment.status === status) return;
    try {
      await updateShipmentStatus(shipment.dbId, status);
      await reloadShipments();
    } catch (error) {
      console.error("Could not update shipment status", error);
      setLoadError(`Couldn't update ${shipment.id}. Please try again.`);
    }
  }

  function exportShipments() {
    const rows = [
      ["Tracking ID", "Customer", "Route", "Service", "ETA", "Status"],
      ...filteredShipments.map(({ id, recipient, route, mode, date, status }) => [id, recipient, route, mode, date, status]),
    ];
    const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "prestige-freight-cargo-shipments.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  const pageTitle = titles[activePage] ?? "Overview";
  const selectedShipment = shipments.find((shipment) => shipment.id === selectedShipmentId);

  return (
    <div className="admin-shell">
      {mobileMenuOpen && <button className="admin-sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`admin-sidebar${mobileMenuOpen ? " admin-sidebar-open" : ""}`}>
        <a className="admin-brand" href="/" aria-label="Prestige Freight Cargo home">
          <img src="/storage/brand/prestige-freight-cargo-light.svg" alt="Prestige Freight Cargo" />
        </a>
        <div className="admin-workspace"><span className="workspace-mark">P</span><span><b>Prestige Freight Cargo</b><small>Workspace</small></span><Icon name="down" size={16} /></div>
        <div className="admin-nav-label">WORKSPACE</div>
        <nav className="admin-nav" aria-label="Dashboard navigation">
          {navigation.map((item) => (
            <button key={item.label} className={activePage === item.label ? "active" : ""} onClick={() => { setActivePage(item.label); setMobileMenuOpen(false); }}>
              <DashboardIcon name={item.icon} />{item.label}
              {item.label === "Shipments" && <span className="nav-count">{shipments.length}</span>}
            </button>
          ))}
        </nav>
        <div className="admin-nav-label admin-tools-label">PREFERENCES</div>
        <nav className="admin-nav" aria-label="Preferences">
          <button className={activePage === "Settings" ? "active" : ""} onClick={() => { setActivePage("Settings"); setMobileMenuOpen(false); }}><DashboardIcon name="settings" />Settings</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><span className="help-mark">?</span><b>Need a hand?</b><p>Our support team is always happy to help.</p><a href="mailto:info@prestigefreightcargo.com">Contact support <span>↗</span></a></div>
          <button className="sidebar-profile" onClick={() => void onSignOut()} title="Sign out"><span className="profile-avatar">{userInitials}</span><span><b>{fullName}</b><small>Sign out</small></span><Icon name="down" size={16} /></button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)}><Icon name="menu" /></button>
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <label className="admin-search"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shipments..." aria-label="Search shipments" /><kbd>⌘ K</kbd></label>
            <div className="notification-wrap">
              <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Icon name="bell" size={19} /><i /></button>
              {notificationsOpen && <div className="notification-popover"><b>Notifications</b><p><span className="notice-dot" /> Shipment PFC-5ZM1-R73P has been delayed.</p><p><span className="notice-dot green" /> Delivery to Goodwell Market was confirmed.</p><small>You're all caught up on recent updates.</small></div>}
            </div>
            <button className="topbar-user" onClick={() => setActivePage("Settings")}><span className="profile-avatar">{userInitials}</span><span><b>{fullName}</b><small>Admin</small></span><Icon name="down" size={15} /></button>
          </div>
        </header>

        <main className="admin-content">
          <div className="page-heading">
            <div><div className="welcome-line"><span className="status-live" /> {todayLabel}</div><h1>{activePage === "Overview" ? `${greeting()}, ${firstName}` : pageTitle}</h1><p>{activePage === "Overview" ? "Here's what's happening with your freight today." : `Manage your ${pageTitle.toLowerCase()} and keep every delivery moving.`}</p></div>
            <div className="heading-actions"><button className="button-secondary" onClick={exportShipments}><Icon name="download" size={17} /> Export</button><button className="button-primary" onClick={() => setModalOpen(true)}><Icon name="plus" size={18} /> New shipment</button></div>
          </div>

          {loadError && <p className="admin-load-error" role="alert">{loadError}</p>}
          <section className="metric-grid" aria-label="Shipping overview">
            <article className="metric-card"><div className="metric-top"><span>Total shipments</span><span className="metric-icon purple"><Icon name="box" size={19} /></span></div><div className="metric-value">1,284</div><div className="metric-foot"><span className="trend-up">↗ 12.8%</span><span>vs. last month</span><span className="sparkline purple-spark"><i /><i /><i /><i /><i /><i /><i /><i /></span></div></article>
            <article className="metric-card"><div className="metric-top"><span>In transit</span><span className="metric-icon blue"><Icon name="pin" size={19} /></span></div><div className="metric-value">342</div><div className="metric-foot"><span className="trend-up">↗ 8.2%</span><span>vs. last month</span><span className="sparkline blue-spark"><i /><i /><i /><i /><i /><i /><i /><i /></span></div></article>
            <article className="metric-card"><div className="metric-top"><span>Delivered</span><span className="metric-icon green"><Icon name="receipt" size={19} /></span></div><div className="metric-value">891</div><div className="metric-foot"><span className="trend-up">↗ 16.4%</span><span>vs. last month</span><span className="sparkline green-spark"><i /><i /><i /><i /><i /><i /><i /><i /></span></div></article>
            <article className="metric-card"><div className="metric-top"><span>On-time delivery</span><span className="metric-icon orange"><Icon name="chart" size={19} /></span></div><div className="metric-value">96.8<span className="metric-unit">%</span></div><div className="metric-foot"><span className="trend-up">↗ 2.4%</span><span>vs. last month</span><span className="sparkline orange-spark"><i /><i /><i /><i /><i /><i /><i /><i /></span></div></article>
          </section>

          <section className="analytics-grid">
            <article className="panel-card performance-card">
              <div className="panel-heading"><div><h2>Shipment performance</h2><p>Freight volume across all services</p></div><button className="select-button">Last 7 days <Icon name="down" size={15} /></button></div>
              <div className="chart-legend"><span><i className="legend-dot ocean-dot" />Ocean freight</span><span><i className="legend-dot air-dot" />Air freight</span><span><i className="legend-dot road-dot" />Road freight</span></div>
              <div className="bar-chart" aria-label="Shipment volume increased throughout the week">
                <div className="chart-y-labels"><span>400</span><span>300</span><span>200</span><span>100</span><span>0</span></div>
                <div className="chart-bars">
                  {[["42%", "24%", "17%"], ["50%", "28%", "19%"], ["39%", "21%", "25%"], ["66%", "31%", "24%"], ["58%", "36%", "27%"], ["75%", "42%", "29%"], ["90%", "49%", "34%"]].map((bars, index) => (
                    <div className="chart-day" key={index}><div className="bar-stack"><i className="bar-ocean" style={{ height: bars[0] }} /><i className="bar-air" style={{ height: bars[1] }} /><i className="bar-road" style={{ height: bars[2] }} /></div><span>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</span></div>
                  ))}
                </div>
              </div>
            </article>
            <article className="panel-card distribution-card">
              <div className="panel-heading"><div><h2>By service type</h2><p>Shipment distribution</p></div><button className="more-button" aria-label="More service options">···</button></div>
              <div className="donut-wrap"><div className="donut-chart"><div><b>1,284</b><span>Shipments</span></div></div></div>
              <div className="distribution-legend"><div><span><i className="legend-dot ocean-dot" />Ocean freight</span><b>48% <small>616</small></b></div><div><span><i className="legend-dot air-dot" />Air freight</span><b>32% <small>411</small></b></div><div><span><i className="legend-dot road-dot" />Road freight</span><b>20% <small>257</small></b></div></div>
            </article>
          </section>

          <section className="panel-card map-panel">
            <div className="panel-heading map-panel-heading">
              <div><h2>Live shipment map</h2><p>{selectedShipment ? `${selectedShipment.id} · ${selectedShipment.mode} · ${SPEED_KMH[selectedShipment.mode]} km/h` : "Track every active shipment around the world"}</p></div>
              {shipments[0] && <a className="text-link" href={`/track?code=${encodeURIComponent((selectedShipment ?? shipments[0]).id)}`} target="_blank" rel="noreferrer">Open client view <Icon name="arrow" size={16} /></a>}
            </div>
            <GoogleShipmentMap shipments={shipments} selectedId={selectedShipmentId} onSelect={setSelectedShipmentId} />
            <div className="map-panel-foot"><span>Estimated movement simulation · Updates every second while in transit</span><span>Road 60 km/h · Sea 35 km/h · Air 800 km/h</span></div>
          </section>

          <section className="panel-card shipments-card">
            <div className="panel-heading shipment-panel-heading"><div><h2>Recent shipments <span className="table-count">{filteredShipments.length}</span></h2><p>Keep an eye on your latest deliveries</p></div><button className="text-link" onClick={() => { setActivePage("Shipments"); setStatusFilter("All shipments"); }}>View all shipments <Icon name="arrow" size={16} /></button></div>
            <div className="table-toolbar">
              <div className="filter-tabs" role="group" aria-label="Filter by shipment status">
                {["All shipments", "In transit", "On hold", "Delivered", "Pending", "Delayed"].map((filter) => <button key={filter} className={statusFilter === filter ? "selected" : ""} onClick={() => setStatusFilter(filter)}>{filter}</button>)}
              </div>
              <button className="table-search-mobile" onClick={() => document.querySelector<HTMLInputElement>(".admin-search input")?.focus()} aria-label="Search shipments"><Icon name="search" size={17} /></button>
            </div>
            <div className="table-scroll"><table className="shipment-table"><thead><tr><th>TRACKING ID</th><th>CUSTOMER</th><th>ROUTE</th><th>SERVICE</th><th>ETA</th><th>STATUS</th><th aria-label="Actions" /></tr></thead>
              <tbody>{filteredShipments.length ? filteredShipments.map((shipment) => <tr key={shipment.id}><td><a className="tracking-id" href={`/track?code=${encodeURIComponent(shipment.id)}`} target="_blank" rel="noreferrer">{shipment.id}</a></td><td><span className="customer-cell"><i>{shipment.initials}</i><b>{shipment.recipient}</b></span></td><td className="route-cell">{shipment.route}</td><td><span className="service-cell"><i className={`service-mark ${shipment.mode.startsWith("Air") ? "air-mark" : shipment.mode.startsWith("Road") ? "road-mark" : ""}`} />{shipment.mode}</span></td><td className="eta-cell">{shipment.date}</td><td><span className={`shipment-status ${shipment.status.toLowerCase().replace(" ", "-")}`}><i />{shipment.status}</span></td><td><div className="row-action-wrap"><button className="row-more" aria-label={`Change status for ${shipment.id}`} aria-expanded={statusMenuId === shipment.id} onClick={() => setStatusMenuId(statusMenuId === shipment.id ? null : shipment.id)}>···</button>{statusMenuId === shipment.id && <div className="row-status-menu" role="menu" aria-label={`Change status for ${shipment.id}`}>{(["In transit", "On hold", "Delayed", "Delivered", "Pending"] as ShipmentStatus[]).map((status) => <button key={status} role="menuitem" className={status === shipment.status ? "current" : ""} onClick={() => void changeShipmentStatus(shipment, status)}><i className={`status-menu-dot ${status.toLowerCase().replace(" ", "-")}`} />{status}{status === shipment.status && <span>Current</span>}</button>)}</div>}</div></td></tr>) : <tr><td className="empty-row" colSpan={7}>No shipments match your search.</td></tr>}</tbody>
            </table></div>
            <div className="table-footer"><span>Showing <b>{filteredShipments.length ? 1 : 0}–{filteredShipments.length}</b> of <b>{shipments.length}</b> shipments</span><div><button disabled aria-label="Previous page">‹</button><button className="current-page">1</button><button disabled aria-label="Next page">›</button></div></div>
          </section>

          <footer className="admin-footer"><span>© 2026 Prestige Freight Cargo</span><span>Need help? <a href="mailto:info@prestigefreightcargo.com">Contact support</a></span></footer>
        </main>
      </section>

      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="shipment-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="modal-icon"><Icon name="box" /></span><h2 id="modal-title">Create a shipment</h2><p>Add a new delivery to your workspace.</p></div><button className="icon-button" aria-label="Close" onClick={() => setModalOpen(false)}><Icon name="close" /></button></div><form onSubmit={addShipment}><label>Customer or recipient<input autoFocus required value={newRecipient} onChange={(event) => setNewRecipient(event.target.value)} placeholder="e.g. Northstar Furniture" /></label><label>Recipient email (optional)<input type="email" value={newRecipientEmail} onChange={(event) => setNewRecipientEmail(event.target.value)} placeholder="name@company.com" /></label><div className="shipment-form-row"><label>From<select value={newOrigin} onChange={(event) => setNewOrigin(event.target.value)}>{CITY_OPTIONS.map((city) => <option key={city.name}>{city.name}</option>)}</select></label><label>To<select value={newDestination} onChange={(event) => setNewDestination(event.target.value)}>{CITY_OPTIONS.filter((city) => city.name !== newOrigin).map((city) => <option key={city.name}>{city.name}</option>)}</select></label></div><label>Service mode<select value={newMode} onChange={(event) => setNewMode(event.target.value as ShipmentMode)}><option>Road freight</option><option>Ocean freight</option><option>Air freight</option></select></label><label>Estimated delivery<input type="date" required value={newDeliveryDate} onChange={(event) => setNewDeliveryDate(event.target.value)} /></label>{formError && <p className="admin-auth-error" role="alert">{formError}</p>}<div className="modal-form-actions"><button className="button-secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="button-primary" type="submit" disabled={saving}><Icon name="plus" size={17} /> {saving ? "Saving…" : "Create shipment"}</button></div></form></section></div>}
    </div>
  );
}
