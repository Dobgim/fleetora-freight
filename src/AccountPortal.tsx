import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import GoogleShipmentMap from "./GoogleShipmentMap";
import { fetchCustomerShipments, type Shipment } from "./shipments";
import { supabase, supabaseConfigurationError } from "./supabase";
import { useAuth } from "./useAuth";

type AuthMode = "sign-in" | "sign-up" | "reset";

export default function AccountPortal() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return hash.get("type") === "recovery" ? "reset" : "sign-in";
  });
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setShipments([]);
      return;
    }

    let active = true;
    void fetchCustomerShipments(user.id).then((rows) => {
      if (active) setShipments(rows);
    }).catch((loadError: unknown) => {
      if (!active) return;
      console.error("Could not load customer shipments", loadError);
      setError("We couldn't load your shipments. Please refresh and try again.");
    });

    return () => { active = false; };
  }, [user]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError(supabaseConfigurationError);
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "reset") {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        setMode("sign-in");
        setPassword("");
        setNotice("Your password was updated. Sign in with the new password.");
      } else if (mode === "sign-up") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/account`,
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice("Check your email to confirm your account, then sign in to see shipments addressed to that email.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (authError) {
      console.error("Customer authentication failed", authError);
      setError(authError instanceof Error ? authError.message : "We couldn't complete that request.");
    } finally {
      setBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!supabase) {
      setError(supabaseConfigurationError);
      return;
    }
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/account`,
      });
      if (resetError) throw resetError;
      setNotice("If an account exists for that email, a password reset link is on its way.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "We couldn't send a reset link.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
    } else {
      setNotice("");
      setError("");
    }
  }

  if (!supabase) {
    return <AccountLayout><div className="account-message" role="alert">{supabaseConfigurationError}</div></AccountLayout>;
  }
  if (loading) {
    return <AccountLayout><div className="account-message">Checking your account…</div></AccountLayout>;
  }
  if (!user || mode === "reset") {
    return (
      <AccountLayout>
        <section className="account-card">
          <span className="account-eyebrow">CUSTOMER PORTAL</span>
          <h1>{mode === "reset" ? "Set a new password" : mode === "sign-in" ? "Welcome back" : "Create your account"}</h1>
          <p>{mode === "reset" ? "Choose a new password for your account." : "Sign in to see shipments assigned to your verified email address."}</p>
          <form onSubmit={submitAuth}>
            {mode === "sign-up" && (
              <label>Full name<input autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
            )}
            {mode !== "reset" && <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
            <label>{mode === "reset" ? "New password" : "Password"}<input type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <p className="account-error" role="alert">{error}</p>}
            {notice && <p className="account-notice" role="status">{notice}</p>}
            <button className="account-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "reset" ? "Update password" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
          </form>
          {mode === "sign-in" && <button className="account-text-button" type="button" disabled={busy} onClick={() => void sendPasswordReset()}>Forgot password?</button>}
          {mode !== "reset" && <p className="account-switch">
            {mode === "sign-in" ? "New to Prestige Freight Cargo?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); setNotice(""); }}>
              {mode === "sign-in" ? "Create an account" : "Sign in"}
            </button>
          </p>}
          <p className="account-footnote">Passwords are managed securely by Supabase Auth. We never store plain-text passwords in the app database.</p>
        </section>
      </AccountLayout>
    );
  }

  return <CustomerDashboard user={user} shipments={shipments} error={error} onSignOut={() => void signOut()} />;
}

function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="account-page">
      <header className="account-header">
        <a href="/"><img src="/storage/brand/prestige-freight-cargo.svg" alt="Prestige Freight Cargo" /></a>
        <nav><a href="/track">Track a shipment</a><a href="/admin">Admin</a></nav>
      </header>
      <main className="account-main">{children}</main>
      <footer className="account-footer"><span>© 2026 Prestige Freight Cargo</span><a href="mailto:info@prestigefreightcargo.com">Contact support</a></footer>
    </div>
  );
}

function CustomerDashboard({ user, shipments, error, onSignOut }: { user: User; shipments: Shipment[]; error: string; onSignOut: () => void }) {
  return (
    <AccountLayout>
      <section className="customer-dashboard">
        <div className="customer-heading">
          <div><span className="account-eyebrow">YOUR SHIPMENTS</span><h1>Your delivery dashboard</h1><p>Signed in as {user.email}</p></div>
          <button className="account-text-button" type="button" onClick={onSignOut}>Sign out</button>
        </div>
        {error && <p className="account-error" role="alert">{error}</p>}
        {shipments.length ? (
          <>
            <div className="customer-shipment-list">
              {shipments.map((shipment) => (
                <a className="customer-shipment-card" href={`/track?code=${encodeURIComponent(shipment.id)}`} key={shipment.dbId}>
                  <span>{shipment.id}</span><b>{shipment.originName} → {shipment.destinationName}</b><small>{shipment.status} · ETA {shipment.date}</small>
                </a>
              ))}
            </div>
            <section className="customer-map-card"><div><h2>Shipment locations</h2><p>Estimated movement advances while a shipment is in transit and pauses on hold.</p></div><GoogleShipmentMap shipments={shipments} className="customer-map" /></section>
          </>
        ) : (
          <div className="account-message"><h2>No shipments linked yet</h2><p>Shipments addressed to your confirmed account email will appear here. You can also track a shipment by number.</p><a className="account-submit account-link-button" href="/track">Track a shipment</a></div>
        )}
      </section>
    </AccountLayout>
  );
}
