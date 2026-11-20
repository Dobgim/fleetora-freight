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

const pageSlugs: Record<string, string> = {
  Overview: "",
  Shipments: "/shipments",
  Tracking: "/tracking",
  Customers: "/customers",
  Invoices: "/invoices",
  Analytics: "/analytics",
  Settings: "/settings",
};

function pageFromPath(): string {
  const slug = window.location.pathname.replace(/^\/admin\/?/, "");
  return Object.entries(pageSlugs).find(([, path]) => path.slice(1) === slug)?.[0] ?? "Overview";
}

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

function localDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type TimelineEventForm = {
  time: string;
  title: string;
  location: string;
};

type ShipmentFormState = {
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  origin: string;
  destination: string;
  mode: ShipmentMode;
  weightKg: string;
  status: ShipmentStatus;
  shipDate: string;
  expectedDeliveryDate: string;
  expectedDeliveryTime: string;
  pieceType: string;
  senderAddress: string;
  recipientAddress: string;
  packageDescription: string;
  timelineEvents: TimelineEventForm[];
};

function newShipmentForm(): ShipmentFormState {
  return {
    senderName: "",
    senderEmail: "",
    senderPhone: "",
    recipientName: "",
    recipientEmail: "",
    recipientPhone: "",
    origin: CITY_OPTIONS[0].name,
    destination: CITY_OPTIONS[1].name,
    mode: "Ocean freight",
    weightKg: "",
    status: "Pending",
    shipDate: localDateValue(new Date()),
    expectedDeliveryDate: "",
    expectedDeliveryTime: "",
    pieceType: "Parcel",
    senderAddress: "",
    recipientAddress: "",
    packageDescription: "",
    timelineEvents: [{ time: "", title: "", location: "" }],
  };
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
  const [activePage, setActivePage] = useState(pageFromPath);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All shipments");
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [shipmentForm, setShipmentForm] = useState<ShipmentFormState>(newShipmentForm);

  useEffect(() => {
    function syncPage() {
      setActivePage(pageFromPath());
    }
    window.addEventListener("popstate", syncPage);
    return () => window.removeEventListener("popstate", syncPage);
  }, []);

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
  const serviceCounts = useMemo(() => ({
    "Ocean freight": shipments.filter((shipment) => shipment.mode === "Ocean freight").length,
    "Air freight": shipments.filter((shipment) => shipment.mode === "Air freight").length,
    "Road freight": shipments.filter((shipment) => shipment.mode === "Road freight").length,
  }), [shipments]);
  const statusCounts = useMemo(() => ({
    "In transit": shipments.filter((shipment) => shipment.status === "In transit").length,
    "On hold": shipments.filter((shipment) => shipment.status === "On hold").length,
    Delayed: shipments.filter((shipment) => shipment.status === "Delayed").length,
    Delivered: shipments.filter((shipment) => shipment.status === "Delivered").length,
    Pending: shipments.filter((shipment) => shipment.status === "Pending").length,
  }), [shipments]);
  const customers = useMemo(() => {
    const grouped = new Map<string, { name: string; count: number; latest: Shipment }>();
    shipments.forEach((shipment) => {
      const key = shipment.recipient.trim().toLowerCase();
      const current = grouped.get(key);
      if (current) current.count += 1;
      else grouped.set(key, { name: shipment.recipient, count: 1, latest: shipment });
    });
    return Array.from(grouped.values());
  }, [shipments]);

  function navigateToPage(page: string) {
    const url = `/admin${pageSlugs[page] ?? ""}`;
    window.history.pushState(null, "", url);
    setActivePage(page);
    setMobileMenuOpen(false);
  }

  async function addShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = shipmentForm;
    const recipient = form.recipientName.trim();
    const origin = CITY_OPTIONS.find((city) => city.name === form.origin);
    const destination = CITY_OPTIONS.find((city) => city.name === form.destination);
    const timelineEvents = form.timelineEvents
      .map((timelineEvent) => ({
        time: timelineEvent.time.trim(),
        title: timelineEvent.title.trim(),
        location: timelineEvent.location.trim(),
      }));
    const nonEmptyEvents = timelineEvents.filter((timelineEvent) => (
      timelineEvent.time || timelineEvent.title || timelineEvent.location
    ));
    if (nonEmptyEvents.some((timelineEvent) => (
      !timelineEvent.time || !timelineEvent.title || !timelineEvent.location
    ))) {
      setFormError("Complete each timeline event or remove the empty event.");
      return;
    }
    if (!recipient || !form.senderName.trim() || !origin || !destination) {
      setFormError("Complete all required shipment fields.");
      return;
    }
    const expectedDeliveryDate = form.expectedDeliveryDate || (() => {
      const date = new Date(`${form.shipDate}T00:00:00`);
      date.setDate(date.getDate() + 7);
      return localDateValue(date);
    })();
    setSaving(true);
    setFormError("");
    try {
      const created = await createShipment({
        recipient,
        recipientEmail: form.recipientEmail.trim(),
        origin,
        destination,
        mode: form.mode,
        estimatedDelivery: expectedDeliveryDate,
        senderName: form.senderName.trim(),
        senderEmail: form.senderEmail.trim(),
        senderPhone: form.senderPhone.trim(),
        recipientPhone: form.recipientPhone.trim(),
        weightKg: Number(form.weightKg),
        status: form.status,
        shipDate: form.shipDate,
        expectedDeliveryTime: form.expectedDeliveryTime || null,
        pieceType: form.pieceType,
        senderAddress: form.senderAddress.trim(),
        recipientAddress: form.recipientAddress.trim(),
        packageDescription: form.packageDescription.trim(),
        timelineEvents: nonEmptyEvents,
      });
      setShipments((current) => [created, ...current.filter((shipment) => shipment.dbId !== created.dbId)]);
      setShipmentForm(newShipmentForm());
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
            <button key={item.label} className={activePage === item.label ? "active" : ""} aria-current={activePage === item.label ? "page" : undefined} onClick={() => navigateToPage(item.label)}>
              <DashboardIcon name={item.icon} />{item.label}
              {item.label === "Shipments" && <span className="nav-count">{shipments.length}</span>}
            </button>
          ))}
        </nav>
        <div className="admin-nav-label admin-tools-label">PREFERENCES</div>
        <nav className="admin-nav" aria-label="Preferences">
          <button className={activePage === "Settings" ? "active" : ""} aria-current={activePage === "Settings" ? "page" : undefined} onClick={() => navigateToPage("Settings")}><DashboardIcon name="settings" />Settings</button>
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
            <button className="topbar-user" onClick={() => navigateToPage("Settings")}><span className="profile-avatar">{userInitials}</span><span><b>{fullName}</b><small>Admin</small></span><Icon name="down" size={15} /></button>
          </div>
        </header>

        <main className="admin-content">
          <div className="page-heading">
            <div><div className="welcome-line"><span className="status-live" /> {todayLabel}</div><h1>{activePage === "Overview" ? `${greeting()}, ${firstName}` : pageTitle}</h1><p>{activePage === "Overview" ? "Here's what's happening with your freight today." : `Manage your ${pageTitle.toLowerCase()} and keep every delivery moving.`}</p></div>
            {(activePage === "Overview" || activePage === "Shipments") && <div className="heading-actions"><button className="button-secondary" onClick={exportShipments}><Icon name="download" size={17} /> Export</button><button className="button-primary" onClick={() => setModalOpen(true)}><Icon name="plus" size={18} /> New shipment</button></div>}
          </div>

          {loadError && <p className="admin-load-error" role="alert">{loadError}</p>}
          {(activePage === "Overview" || activePage === "Analytics") && <section className="metric-grid" aria-label="Shipping overview">
            <article className="metric-card"><div className="metric-top"><span>Total shipments</span><span className="metric-icon purple"><Icon name="box" size={19} /></span></div><div className="metric-value">{shipments.length}</div><div className="metric-foot"><span>In this workspace</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>In transit</span><span className="metric-icon blue"><Icon name="pin" size={19} /></span></div><div className="metric-value">{statusCounts["In transit"]}</div><div className="metric-foot"><span>Currently moving</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>Delivered</span><span className="metric-icon green"><Icon name="receipt" size={19} /></span></div><div className="metric-value">{statusCounts.Delivered}</div><div className="metric-foot"><span>Completed shipments</span></div></article>
            <article className="metric-card"><div className="metric-top"><span>Needs attention</span><span className="metric-icon orange"><Icon name="chart" size={19} /></span></div><div className="metric-value">{statusCounts["On hold"] + statusCounts.Delayed}</div><div className="metric-foot"><span>On hold or delayed</span></div></article>
          </section>}

          {(activePage === "Overview" || activePage === "Analytics") && <section className="analytics-grid">
            <article className="panel-card performance-card">
              <div className="panel-heading"><div><h2>Shipment status</h2><p>Current records by status</p></div></div>
              <div className="admin-count-list">{Object.entries(statusCounts).map(([status, count]) => <div key={status}><span>{status}</span><b>{count}</b><i><span style={{ width: `${shipments.length ? count / shipments.length * 100 : 0}%` }} /></i></div>)}</div>
            </article>
            <article className="panel-card distribution-card">
              <div className="panel-heading"><div><h2>By service type</h2><p>Current shipments by mode</p></div></div>
              <div className="admin-count-list">{Object.entries(serviceCounts).map(([mode, count]) => <div key={mode}><span>{mode}</span><b>{count}</b><i><span style={{ width: `${shipments.length ? count / shipments.length * 100 : 0}%` }} /></i></div>)}</div>
            </article>
          </section>}

          {(activePage === "Overview" || activePage === "Tracking") && <section className="panel-card map-panel">
            <div className="panel-heading map-panel-heading">
              <div><h2>Shipment map</h2><p>{selectedShipment ? `${selectedShipment.id} · estimated ${selectedShipment.mode} movement · ${SPEED_KMH[selectedShipment.mode]} km/h` : "Estimated positions for active shipments"}</p></div>
              {shipments[0] && <a className="text-link" href={`/track?code=${encodeURIComponent((selectedShipment ?? shipments[0]).id)}`} target="_blank" rel="noreferrer">Open client view <Icon name="arrow" size={16} /></a>}
            </div>
            <GoogleShipmentMap shipments={shipments} selectedId={selectedShipmentId} onSelect={setSelectedShipmentId} />
            <div className="map-panel-foot"><span>Estimated movement · Pauses when a shipment is not in transit</span><span>Road 60 km/h · Sea 35 km/h · Air 800 km/h</span></div>
          </section>}

          {(activePage === "Overview" || activePage === "Shipments") && <section className="panel-card shipments-card">
            <div className="panel-heading shipment-panel-heading"><div><h2>{activePage === "Overview" ? "Recent shipments" : "All shipments"} <span className="table-count">{filteredShipments.length}</span></h2><p>{activePage === "Overview" ? "Keep an eye on your latest deliveries" : "Search, filter and update shipment status"}</p></div>{activePage === "Overview" && <button className="text-link" onClick={() => { setStatusFilter("All shipments"); setSearch(""); navigateToPage("Shipments"); }}>View all shipments <Icon name="arrow" size={16} /></button>}</div>
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
          </section>}

          {activePage === "Customers" && <section className="panel-card admin-data-page"><div className="panel-heading"><div><h2>Customers</h2><p>Recipients from existing shipment records</p></div><span className="table-count">{customers.length}</span></div>{customers.length ? <div className="table-scroll"><table className="shipment-table"><thead><tr><th>CUSTOMER</th><th>SHIPMENTS</th><th>LATEST TRACKING ID</th><th>STATUS</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.name.toLowerCase()}><td>{customer.name}</td><td>{customer.count}</td><td><a className="tracking-id" href={`/track?code=${encodeURIComponent(customer.latest.id)}`} target="_blank" rel="noreferrer">{customer.latest.id}</a></td><td>{customer.latest.status}</td></tr>)}</tbody></table></div> : <p className="admin-empty-state">Customers will appear here after shipments are created.</p>}</section>}

          {activePage === "Invoices" && <section className="panel-card admin-empty-state"><h2>Invoices</h2><p>Invoice management is not connected to this workspace yet. No billing data is shown here.</p></section>}

          {activePage === "Settings" && <section className="panel-card admin-settings-page"><div><span className="account-eyebrow">WORKSPACE ACCESS</span><h2>Account settings</h2><p>Administrator sign-in and security are managed by Supabase Auth.</p></div><dl><div><dt>Signed in as</dt><dd>{user.email}</dd></div><div><dt>Workspace</dt><dd>Prestige Freight Cargo</dd></div></dl><button className="button-secondary" onClick={() => void onSignOut()}>Sign out</button></section>}

          <footer className="admin-footer"><span>© 2026 Prestige Freight Cargo</span><span>Need help? <a href="mailto:info@prestigefreightcargo.com">Contact support</a></span></footer>
        </main>
      </section>

      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
        <section className="shipment-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-heading">
            <div><h2 id="modal-title">Create New Shipment</h2></div>
            <button className="icon-button" aria-label="Close" onClick={() => setModalOpen(false)}><Icon name="close" /></button>
          </div>
          <form onSubmit={addShipment}>
            <div className="shipment-form-grid">
              <label>Tracking ID<input value="Generated when saved" readOnly /></label>
              <label>Shipment type *<select required value={shipmentForm.mode} onChange={(event) => setShipmentForm({ ...shipmentForm, mode: event.target.value as ShipmentMode })}><option>Road freight</option><option>Ocean freight</option><option>Air freight</option></select></label>
              <label>Sender name *<input autoFocus required value={shipmentForm.senderName} onChange={(event) => setShipmentForm({ ...shipmentForm, senderName: event.target.value })} placeholder="Sender name" /></label>
              <label>Receiver name *<input required value={shipmentForm.recipientName} onChange={(event) => setShipmentForm({ ...shipmentForm, recipientName: event.target.value })} placeholder="Receiver name" /></label>
              <label>Sender email<input type="email" value={shipmentForm.senderEmail} onChange={(event) => setShipmentForm({ ...shipmentForm, senderEmail: event.target.value })} placeholder="sender@example.com" /></label>
              <label>Receiver email<input type="email" value={shipmentForm.recipientEmail} onChange={(event) => setShipmentForm({ ...shipmentForm, recipientEmail: event.target.value })} placeholder="receiver@example.com" /></label>
              <label>Sender number<input type="tel" value={shipmentForm.senderPhone} onChange={(event) => setShipmentForm({ ...shipmentForm, senderPhone: event.target.value })} placeholder="e.g. +1 234 567 8900" /></label>
              <label>Receiver number<input type="tel" value={shipmentForm.recipientPhone} onChange={(event) => setShipmentForm({ ...shipmentForm, recipientPhone: event.target.value })} placeholder="e.g. +1 987 654 3210" /></label>
              <label>Origin *<select required value={shipmentForm.origin} onChange={(event) => setShipmentForm({ ...shipmentForm, origin: event.target.value })}>{CITY_OPTIONS.map((city) => <option key={city.name}>{city.name}</option>)}</select></label>
              <label>Destination *<select required value={shipmentForm.destination} onChange={(event) => setShipmentForm({ ...shipmentForm, destination: event.target.value })}>{CITY_OPTIONS.filter((city) => city.name !== shipmentForm.origin).map((city) => <option key={city.name}>{city.name}</option>)}</select></label>
              <label>Weight (kg) *<input type="number" min="0" step="0.1" required value={shipmentForm.weightKg} onChange={(event) => setShipmentForm({ ...shipmentForm, weightKg: event.target.value })} placeholder="0.0" /></label>
              <label>Status *<select required value={shipmentForm.status} onChange={(event) => setShipmentForm({ ...shipmentForm, status: event.target.value as ShipmentStatus })}><option>Pending</option><option>In transit</option><option>Delivered</option><option>Delayed</option><option>On hold</option></select></label>
              <label>Ship date *<input type="date" required value={shipmentForm.shipDate} onChange={(event) => setShipmentForm({ ...shipmentForm, shipDate: event.target.value })} /></label>
              <label>Expected delivery date<input type="date" value={shipmentForm.expectedDeliveryDate} onChange={(event) => setShipmentForm({ ...shipmentForm, expectedDeliveryDate: event.target.value })} /></label>
              <label>Expected delivery time<input type="time" value={shipmentForm.expectedDeliveryTime} onChange={(event) => setShipmentForm({ ...shipmentForm, expectedDeliveryTime: event.target.value })} /></label>
              <label>Piece type<select value={shipmentForm.pieceType} onChange={(event) => setShipmentForm({ ...shipmentForm, pieceType: event.target.value })}><option>Parcel</option><option>Box</option><option>Pallet</option><option>Document</option><option>Container</option><option>Other</option></select></label>
              <label>Sender address<input value={shipmentForm.senderAddress} onChange={(event) => setShipmentForm({ ...shipmentForm, senderAddress: event.target.value })} placeholder="Full address" /></label>
              <label>Receiver address<input value={shipmentForm.recipientAddress} onChange={(event) => setShipmentForm({ ...shipmentForm, recipientAddress: event.target.value })} placeholder="Full address" /></label>
              <label className="shipment-form-full">Package description<textarea rows={3} value={shipmentForm.packageDescription} onChange={(event) => setShipmentForm({ ...shipmentForm, packageDescription: event.target.value })} placeholder="Describe the package contents..." /></label>
            </div>
            <section className="timeline-events-editor" aria-label="Timeline events">
              <div className="timeline-events-heading"><h3>Timeline events</h3><button className="button-secondary" type="button" onClick={() => setShipmentForm({ ...shipmentForm, timelineEvents: [...shipmentForm.timelineEvents, { time: "", title: "", location: "" }] })}>+ Add event</button></div>
              {shipmentForm.timelineEvents.map((timelineEvent, index) => <div className="timeline-event-row" key={index}>
                <div className="shipment-form-row">
                  <input aria-label={`Event ${index + 1} time`} value={timelineEvent.time} onChange={(event) => setShipmentForm({ ...shipmentForm, timelineEvents: shipmentForm.timelineEvents.map((item, itemIndex) => itemIndex === index ? { ...item, time: event.target.value } : item) })} placeholder="Time (e.g. Today, 10:45 AM)" />
                  <input aria-label={`Event ${index + 1} title`} value={timelineEvent.title} onChange={(event) => setShipmentForm({ ...shipmentForm, timelineEvents: shipmentForm.timelineEvents.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })} placeholder="Event title (e.g. Out for Delivery)" />
                </div>
                <div className="timeline-event-location"><input aria-label={`Event ${index + 1} location`} value={timelineEvent.location} onChange={(event) => setShipmentForm({ ...shipmentForm, timelineEvents: shipmentForm.timelineEvents.map((item, itemIndex) => itemIndex === index ? { ...item, location: event.target.value } : item) })} placeholder="Location details (e.g. London, UK)" />{shipmentForm.timelineEvents.length > 1 && <button className="timeline-event-remove" type="button" aria-label={`Remove event ${index + 1}`} onClick={() => setShipmentForm({ ...shipmentForm, timelineEvents: shipmentForm.timelineEvents.filter((_, itemIndex) => itemIndex !== index) })}><Icon name="close" size={15} /></button>}</div>
              </div>)}
            </section>
            {formError && <p className="admin-auth-error" role="alert">{formError}</p>}
            <div className="modal-form-actions"><button className="button-secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="button-primary" type="submit" disabled={saving}><Icon name="plus" size={17} /> {saving ? "Saving…" : "Save & Create Shipment"}</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}
