import { useI18n } from "../services/i18n";
import { usePortalTheme } from "../services/portalTheme";

export default function LangToggle() {
  const { lang, setLang } = useI18n();
  const { p } = usePortalTheme();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      aria-label="Change language"
      style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${p.border}`, background: "transparent", color: p.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
    >
      {lang === "ar" ? "English" : "عربي"}
    </button>
  );
}