import AdminDashboard from "./AdminDashboard";

export default function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminDashboard />;
  }

  return (
    <main className="h-dvh w-full overflow-hidden bg-white">
      <iframe
        className="block h-full w-full border-0"
        src="/home.html"
        title="Fleetora Freights"
        allow="clipboard-write"
      />
    </main>
  );
}
