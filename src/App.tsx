import AdminGate from "./AdminGate";
import AccountPortal from "./AccountPortal";
import ClientTracking from "./ClientTracking";
import PublicPage, { isPublicPage } from "./PublicPage";

export default function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <AdminGate />;
  }
  if (window.location.pathname.startsWith("/account")) {
    return <AccountPortal />;
  }
  if (window.location.pathname.startsWith("/track")) {
    return <ClientTracking />;
  }
  if (isPublicPage(window.location.pathname)) {
    return <PublicPage path={window.location.pathname} />;
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
