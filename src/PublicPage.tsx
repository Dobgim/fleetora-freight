type PageDefinition = {
  eyebrow: string;
  title: string;
  description: string;
  cards: { title: string; body: string; id?: string }[];
  action: { label: string; href: string };
};

const pages: Record<string, PageDefinition> = {
  "/services": {
    eyebrow: "OUR SERVICES",
    title: "Freight that fits the way you ship.",
    description: "Choose a service and a team that can take your cargo from collection through delivery.",
    cards: [
      { title: "Ocean freight", body: "Full-container and shared-container shipping for international cargo.", id: "ocean" },
      { title: "Air freight", body: "Time-sensitive shipments with express and standard service options.", id: "air" },
      { title: "Road freight", body: "Flexible full and partial loads across regional transport lanes.", id: "road" },
      { title: "Warehousing", body: "Storage, fulfilment and dispatch support for your inventory.", id: "warehousing" },
      { title: "Parcels", body: "Tracked parcel delivery for business and personal shipments.", id: "parcels" },
      { title: "Pet transport", body: "Coordinated door-to-door transport and care for animal shipments.", id: "pet" },
      { title: "Customs brokerage", body: "Practical support for customs documentation and clearance.", id: "customs" },
    ],
    action: { label: "Request a quote", href: "/pricing" },
  },
  "/about": {
    eyebrow: "ABOUT PRESTIGE",
    title: "A real team behind every shipment.",
    description: "We coordinate air, ocean and road freight with clear updates, one point of contact and support when plans change.",
    cards: [
      { title: "One coordinator", body: "A consistent contact keeps booking, handoffs and delivery details together." },
      { title: "Clear updates", body: "Shipment status and estimated progress are easy to check through the customer portal." },
      { title: "Flexible service", body: "Choose the route and freight mode that best fits your delivery needs." },
    ],
    action: { label: "Talk to our team", href: "/contact" },
  },
  "/locations": {
    eyebrow: "OUR NETWORK",
    title: "Connected routes, coordinated locally.",
    description: "Our operations coordinate freight through major transport hubs and partner locations.",
    cards: [
      { title: "Newark, United States", body: "North American gateway for road and ocean shipments." },
      { title: "Rotterdam, Netherlands", body: "European port access and onward delivery coordination." },
      { title: "London, United Kingdom", body: "Regional support for air freight and parcel services." },
      { title: "Toronto, Canada", body: "Destination coordination for cross-border shipments." },
    ],
    action: { label: "Ask about a route", href: "/contact" },
  },
  "/pricing": {
    eyebrow: "PRICING & QUOTES",
    title: "Get a quote for your route.",
    description: "Freight pricing depends on cargo size, service, route and timing. Share your shipment details with our team for an accurate estimate.",
    cards: [
      { title: "Ocean freight", body: "Quote options for full and shared container shipments." },
      { title: "Air freight", body: "Pricing based on chargeable weight, service speed and destination." },
      { title: "Road freight", body: "Pricing based on distance, load size and collection requirements." },
    ],
    action: { label: "Email for a quote", href: "mailto:info@prestigefreightcargo.com?subject=Freight%20quote%20request" },
  },
  "/contact": {
    eyebrow: "CONTACT",
    title: "Let's plan your next shipment.",
    description: "Tell us where your cargo is going and our team will help you choose a service and next steps.",
    cards: [
      { title: "Email", body: "info@prestigefreightcargo.com" },
      { title: "Phone", body: "+1 (800) 555 0142" },
      { title: "Shipment support", body: "Have a tracking number? Open the tracking page for shipment status and estimated location." },
    ],
    action: { label: "Email our team", href: "mailto:info@prestigefreightcargo.com" },
  },
};

export function isPublicPage(path: string): boolean {
  return path in pages;
}

export default function PublicPage({ path }: { path: string }) {
  const page = pages[path];
  if (!page) return null;

  return (
    <div className="public-page">
      <header className="public-page-header">
        <a href="/"><img src="/storage/brand/prestige-freight-cargo.svg" alt="Prestige Freight Cargo" /></a>
        <nav aria-label="Main navigation">
          <a href="/services" aria-current={path === "/services" ? "page" : undefined}>Services</a>
          <a href="/about" aria-current={path === "/about" ? "page" : undefined}>About</a>
          <a href="/locations" aria-current={path === "/locations" ? "page" : undefined}>Locations</a>
          <a href="/track">Tracking</a>
          <a href="/pricing" aria-current={path === "/pricing" ? "page" : undefined}>Pricing</a>
          <a href="/contact" aria-current={path === "/contact" ? "page" : undefined}>Contact</a>
          <a href="/account">Customer login</a>
        </nav>
      </header>
      <main className="public-page-content">
        <section className="public-page-hero">
          <span>{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
          <a href={page.action.href}>{page.action.label} <b aria-hidden="true">→</b></a>
        </section>
        <section className="public-page-cards" aria-label={page.eyebrow}>
          {page.cards.map((card) => <article id={card.id} key={card.title}><h2>{card.title}</h2><p>{card.body}</p></article>)}
        </section>
      </main>
      <footer className="public-page-footer"><span>© 2026 Prestige Freight Cargo</span><a href="mailto:info@prestigefreightcargo.com">info@prestigefreightcargo.com</a></footer>
    </div>
  );
}
