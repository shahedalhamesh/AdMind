import { useState } from "react";
import { usePortalTheme } from "../services/portalTheme";
import { Btn } from "../components/Ui";
import NotificationsPanel from "../components/NotificationsPanel";

export default function Notifications() {
  const { p } = usePortalTheme();
  const [unreadOnly, setUnreadOnly] = useState(false);
  return (
    <div style={{ maxWidth: 760 }}>
      <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: p.eyeb }}>Notifications</p>
      <h1 style={{ margin: "10px 0 0", fontFamily: "Georgia, serif", fontSize: 38, fontWeight: 500 }}>Notifications</h1>
      <div style={{ display: "flex", gap: 8, margin: "20px 0" }}>
        <Btn small variant={unreadOnly ? "ghost" : "primary"} onClick={() => setUnreadOnly(false)}>All</Btn>
        <Btn small variant={unreadOnly ? "primary" : "ghost"} onClick={() => setUnreadOnly(true)}>Unread</Btn>
      </div>
      <NotificationsPanel limit={50} unreadOnly={unreadOnly} />
    </div>
  );
}