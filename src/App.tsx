import AdminGate from "./AdminGate";
import ClientTracking from "./ClientTracking";

export default function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminGate />;
  }
  if (window.location.pathname.startsWith("/track")) {
    return <ClientTracking />;
  }

  return (
    <main className="h-dvh w-full overflow-hidden bg-white">
      <iframe
        className="block h-full w-full border-0"
        src="/home.html"
        title="Prestige Freight Cargo"
        allow="clipboard-write"
      />
    </main>
  );
}
