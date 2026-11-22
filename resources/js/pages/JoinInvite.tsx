import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../components/AuthContext";
import { homeFor } from "../services/auth";
import { usePortalTheme } from "../services/portalTheme";
import { nameOf, publicJoinApi } from "../services/invites";
import PublicShell from "../components/PublicShell";
import { Btn, Field, Loading, Notice, TextInput, errorText, fieldError } from "../components/Ui";

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function JoinInvite() {
  const { p } = usePortalTheme();
  const token = useParams().token ?? "";
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const preview = useQuery({ queryKey: ["join", token], queryFn: () => publicJoinApi.preview(token), retry: false });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const accept = useMutation({
    mutationFn: (body: { credential: string; name?: string } | { name: string; password: string }) => publicJoinApi.accept(token, body),
    onSuccess: (res) => {
      signIn(res);
      navigate(homeFor(res.user), { replace: true });
    },
  });

  if (preview.isLoading) return <PublicShell><Loading /></PublicShell>;

  if (preview.isError || !preview.data) {
    return (
      <PublicShell>
        <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 500 }}>This invitation is not valid</h1>
        <p style={{ margin: "10px 0 16px", fontSize: 14, lineHeight: 1.6, color: p.muted }}>{errorText(preview.error)} Ask the person who invited you for a new link.</p>
        <Link to="/login" style={{ color: p.link, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Go to sign in</Link>
      </PublicShell>
    );
  }

  const d = preview.data;
  return (
    <PublicShell>
      <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 500 }}>Join {d.company_name}</h1>
      <p style={{ margin: "10px 0 18px", fontSize: 15, lineHeight: 1.6, color: p.muted }}>
        {d.company_name} invites you as <strong style={{ color: p.text }}>{nameOf(d.role)}</strong>
        {d.client_name ? <> for <strong style={{ color: p.text }}>{d.client_name}</strong></> : null}.
        The email for this invitation is <strong style={{ color: p.text }}>{d.email}</strong>.
      </p>

      {GOOGLE_ID && (
        <div style={{ marginBottom: 18 }}>
          <GoogleLogin onSuccess={(r) => { if (r.credential) accept.mutate({ credential: r.credential, ...(name.trim() ? { name: name.trim() } : {}) }); }} onError={() => undefined} />
          <div style={{ fontSize: 12, color: p.muted, marginTop: 8 }}>Use the Google account of {d.email}.</div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); accept.mutate({ name: name.trim(), password }); }} style={{ display: "grid", gap: 14 }}>
        <div style={{ fontSize: 13, color: p.muted }}>{GOOGLE_ID ? "Or choose a password" : "Choose a password"}</div>
        <Field label="Your name *" error={fieldError(accept.error, "name")}><TextInput value={name} onChange={(e) => setName(e.target.value)} dir="auto" required /></Field>
        <Field label="Password * (8 characters or more)" error={fieldError(accept.error, "password")}><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></Field>
        {accept.isError && <Notice kind="error">{errorText(accept.error)}</Notice>}
        <Btn variant="primary" type="submit" disabled={accept.isPending || !name.trim() || password.length < 8}>{accept.isPending ? "Joining…" : "Join"}</Btn>
      </form>
    </PublicShell>
  );
}