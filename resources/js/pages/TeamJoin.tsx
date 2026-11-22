import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GoogleLogin } from "@react-oauth/google";
import { usePortalTheme } from "../services/portalTheme";
import { nameOf, publicJoinApi } from "../services/invites";
import PublicShell from "../components/PublicShell";
import { Btn, Field, Loading, Notice, TextInput, errorText, fieldError } from "../components/Ui";

const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function TeamJoin() {
  const { p } = usePortalTheme();
  const token = useParams().token ?? "";
  const preview = useQuery({ queryKey: ["team-join", token], queryFn: () => publicJoinApi.teamPreview(token), retry: false });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const join = useMutation({
    mutationFn: (body: { credential: string; name?: string } | { name: string; email: string; password: string }) => publicJoinApi.teamJoin(token, body),
  });

  if (preview.isLoading) return <PublicShell><Loading /></PublicShell>;

  if (preview.isError || !preview.data) {
    return (
      <PublicShell>
        <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 500 }}>This link is not valid</h1>
        <p style={{ margin: "10px 0 16px", fontSize: 14, lineHeight: 1.6, color: p.muted }}>{errorText(preview.error)} Ask for a new link.</p>
        <Link to="/login" style={{ color: p.link, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Go to sign in</Link>
      </PublicShell>
    );
  }

  const d = preview.data;

  if (join.isSuccess) {
    return (
      <PublicShell>
        <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 500 }}>Request sent</h1>
        <p style={{ margin: "10px 0 16px", fontSize: 15, lineHeight: 1.6, color: p.muted }}>Your request was sent. You can sign in after an Owner approves it.</p>
        <Link to="/login" style={{ color: p.link, fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Go to sign in</Link>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <h1 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 500 }}>{d.label || `Join ${d.company_name}`}</h1>
      <p style={{ margin: "10px 0 18px", fontSize: 15, lineHeight: 1.6, color: p.muted }}>
        Ask to join <strong style={{ color: p.text }}>{d.company_name}</strong> as <strong style={{ color: p.text }}>{nameOf(d.role)}</strong>. An Owner has to approve you before you can sign in.
      </p>

      {GOOGLE_ID && (
        <div style={{ marginBottom: 18 }}>
          <GoogleLogin onSuccess={(r) => { if (r.credential) join.mutate({ credential: r.credential, ...(name.trim() ? { name: name.trim() } : {}) }); }} onError={() => undefined} />
          <div style={{ fontSize: 12, color: p.muted, marginTop: 8 }}>Or fill in the form below.</div>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); join.mutate({ name: name.trim(), email: email.trim(), password }); }} style={{ display: "grid", gap: 14 }}>
        <Field label="Your name *" error={fieldError(join.error, "name")}><TextInput value={name} onChange={(e) => setName(e.target.value)} dir="auto" required /></Field>
        <Field label="Email *" error={fieldError(join.error, "email")}><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Password * (8 characters or more)" error={fieldError(join.error, "password")}><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></Field>
        {join.isError && <Notice kind="error">{errorText(join.error)}</Notice>}
        <Btn variant="primary" type="submit" disabled={join.isPending || !name.trim() || !email.trim() || password.length < 8}>{join.isPending ? "Sending…" : "Ask to join"}</Btn>
      </form>
    </PublicShell>
  );
}