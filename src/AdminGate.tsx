import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import AdminDashboard from "./AdminDashboard";
import { supabase, supabaseConfigurationError } from "./supabase";
import { useAuth } from "./useAuth";

type RoleState = "checking" | "admin" | "denied" | "error";

function AuthCard({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="admin-auth">
      <section className="shipment-modal admin-auth-card" aria-labelledby="admin-auth-title">
        <a href="/" className="admin-auth-brand"><img src="/storage/brand/prestige-freight-cargo.svg" alt="Prestige Freight Cargo" /></a>
        <div className="modal-heading"><div><h2 id="admin-auth-title">{title}</h2><p>{text}</p></div></div>
        {children}
      </section>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setError(signInError.message === "Invalid login credentials" ? "That email and password don't match an account." : signInError.message);
  }

  return (
    <AuthCard title="Sign in" text="Operations team access for Prestige Freight Cargo.">
      <form onSubmit={signIn}>
        <label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="admin-auth-error" role="alert">{error}</p>}
        <div className="modal-form-actions"><a className="button-secondary" href="/">Back to site</a><button className="button-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></div>
      </form>
    </AuthCard>
  );
}

export default function AdminGate() {
  const { user, loading, error } = useAuth();
  const [role, setRole] = useState<RoleState>("checking");

  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    setRole("checking");
    void supabase.rpc("is_admin").then(({ data, error: roleError }) => {
      if (!active) return;
      if (roleError) {
        console.error("Could not check administrator access", roleError);
        setRole("error");
      } else {
        setRole(data ? "admin" : "denied");
      }
    });
    return () => { active = false; };
  }, [user]);

  async function signOut() {
    await supabase?.auth.signOut();
  }

  if (!supabase) return <AuthCard title="Not connected" text={supabaseConfigurationError} />;
  if (loading) return <AuthCard title="Loading" text="Checking your session…" />;
  if (error && !user) return <AuthCard title="Sign-in unavailable" text={error} />;
  if (!user) return <SignInForm />;
  if (role === "checking") return <AuthCard title="Loading" text="Checking your access…" />;
  if (role !== "admin") {
    return (
      <AuthCard
        title={role === "error" ? "Couldn't check access" : "No dashboard access"}
        text={role === "error" ? "Please refresh the page and try again." : `${user.email ?? "This account"} isn't an administrator for this workspace.`}
      >
        <div className="modal-form-actions"><a className="button-secondary" href="/">Back to site</a><button className="button-primary" onClick={() => void signOut()}>Sign out</button></div>
      </AuthCard>
    );
  }
  return <AdminDashboard user={user} onSignOut={signOut} />;
}
