import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";
import { can } from "../../services/auth";
import { usePortalTheme } from "../../services/portalTheme";
import { clientsApi } from "../../services/clients";
import type { Client, DocumentSaved } from "../../services/clients";
import { Badge, Btn, Card, Field, Loading, Notice, TextArea, TextInput, errorText, fieldError } from "../Ui";

// Price lists, menus, brand books... The AI reads them as reference.
// Add either pasted text or one file (pdf, docx, txt, md, up to 10 MB).
export default function DocumentsTab({ client }: { client: Client }) {
  const { p } = usePortalTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = can(user, "clients.update");

  const list = useQuery({ queryKey: ["client-docs", client.id], queryFn: () => clientsApi.documents(client.id) });

  const [mode, setMode] = useState<"text" | "file">("file");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const add = useMutation({
    mutationFn: (): Promise<DocumentSaved> =>
      mode === "file" && file
        ? clientsApi.addFile(client.id, file, title.trim() || undefined)
        : clientsApi.addText(client.id, { title: title.trim() || undefined, text }),
    onSuccess: () => {
      setTitle("");
      setText("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["client-docs", client.id] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => clientsApi.removeDocument(client.id, id),
    onSuccess: () => {
      setConfirming(null);
      qc.invalidateQueries({ queryKey: ["client-docs", client.id] });
    },
  });

  const ready = mode === "file" ? !!file : text.trim().length > 0;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {canEdit && (
        <Card>
          <h3 style={{ margin: 0, fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 500 }}>Add a document</h3>
          <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
            <Btn small variant={mode === "file" ? "primary" : "ghost"} onClick={() => setMode("file")}>Upload a file</Btn>
            <Btn small variant={mode === "text" ? "primary" : "ghost"} onClick={() => setMode("text")}>Paste text</Btn>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} style={{ display: "grid", gap: 14 }}>
            <Field label="Title" error={fieldError(add.error, "title")} hint={mode === "file" ? "Optional. The file name is used if you leave it empty." : "Optional."}>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
            </Field>

            {mode === "file" ? (
              <Field label="File" error={fieldError(add.error, "file")} hint="PDF, DOCX, TXT or MD, up to 10 MB.">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  style={{ color: p.text, fontSize: 14, fontFamily: "inherit" }}
                />
              </Field>
            ) : (
              <Field label="Text" error={fieldError(add.error, "text")}>
                <TextArea value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 140 }} />
              </Field>
            )}

            {add.isError && <Notice kind="error">{errorText(add.error)}</Notice>}
            {add.isSuccess && add.data.warning && <Notice kind="warning">{add.data.warning}</Notice>}
            {add.isSuccess && !add.data.warning && <Notice kind="success">Added. The AI can use it now.</Notice>}

            <div>
              <Btn variant="primary" type="submit" disabled={add.isPending || !ready}>
                {add.isPending ? "Adding… (this can take a moment)" : "Add document"}
              </Btn>
            </div>
          </form>
        </Card>
      )}

      {list.isLoading && <Loading />}
      {list.isError && <Notice kind="error">{errorText(list.error)}</Notice>}
      {list.isSuccess && list.data.length === 0 && (
        <div style={{ padding: 24, borderRadius: 16, border: `1px dashed ${p.border}`, color: p.muted, fontSize: 14 }}>
          No documents yet.
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {list.data.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, border: `1px solid ${p.border}`, background: p.card, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 15, fontWeight: 600, overflowWrap: "anywhere" }}>{d.title}</div>
                <div style={{ marginTop: 3, fontSize: 12, color: p.muted }}>{new Date(d.created_at).toLocaleDateString()}</div>
              </div>
              <Badge>{d.source_type === "file" ? "File" : "Text"}</Badge>
              {canEdit && (
                confirming === d.id ? (
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    Delete this document?
                    <Btn small variant="danger" onClick={() => remove.mutate(d.id)} disabled={remove.isPending}>{remove.isPending ? "Deleting…" : "Yes, delete"}</Btn>
                    <Btn small onClick={() => setConfirming(null)}>No</Btn>
                  </span>
                ) : (
                  <Btn small variant="danger" onClick={() => { remove.reset(); setConfirming(d.id); }}>Delete</Btn>
                )
              )}
            </div>
          ))}
          {remove.isError && <Notice kind="error">{errorText(remove.error)}</Notice>}
        </div>
      )}
    </div>
  );
}