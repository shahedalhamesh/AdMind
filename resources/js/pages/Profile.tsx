import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../services/api";
import { useAuth } from "../components/AuthContext";
import { usePortalTheme } from "../services/portalTheme";
import { Btn, Card, Field, Notice, TextInput, errorText, fieldError } from "../components/Ui";

/* POST /me/password: {current_password, password, password_confirmation}. Other devices are signed out. */

export default function Profile() {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");

  const change = useMutation({
    mutationFn: () => api<unknown>("/me/password", { method: "POST", body: { current_password: current, password: next, password_confirmation: again } }),
    onSuccess: () => { setCurrent(""); setNext(""); setAgain(""); },
  });

  const mismatch = again.length > 0 && next !== again;
  const row = (label: string, value?: string | null) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: p.eyeb }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 15, overflowWrap: "anywhere" }}>{value || <span style={{ color: p.muted }}>Not set</span>}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Account</p>
      <h1 style={{ margin: "10px 0 22px", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>My account</h1>

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          {row("Name", user?.name)}
          {row("Email", user?.email)}
          {row("Role", user?.role)}
        </div>
      </Card>

      <div style={{ marginTop: 22 }}>
        <Card>
          <h3 style={{ margin: "0 0 14px", fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Change password</h3>
          <form onSubmit={(e) => { e.preventDefault(); change.mutate(); }} style={{ display: "grid", gap: 14 }}>
            <Field label="Current password *" error={fieldError(change.error, "current_password")}>
              <TextInput type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
            </Field>
            <Field label="New password * (8 characters or more)" error={fieldError(change.error, "password")}>
              <TextInput type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} autoComplete="new-password" required />
            </Field>
            <Field label="Repeat the new password *" error={mismatch ? "The two passwords do not match." : fieldError(change.error, "password_confirmation")}>
              <TextInput type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
            </Field>
            {change.isError && !fieldError(change.error, "current_password") && !fieldError(change.error, "password") && <Notice kind="error">{errorText(change.error)}</Notice>}
            {change.isSuccess && <Notice kind="success">Password changed. You were signed out on your other devices.</Notice>}
            <div>
              <Btn variant="primary" type="submit" disabled={change.isPending || !current || next.length < 8 || next !== again}>{change.isPending ? "Saving…" : "Change password"}</Btn>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}