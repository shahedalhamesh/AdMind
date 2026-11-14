import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export type Lang = "en" | "ar";
const KEY = "admind_lang";

/* English text (exact, trimmed) → Arabic. A text that is not here stays English.
   To find what is still missing: switch to Arabic, open the browser console, run  __missingTexts()  */
const ar: Record<string, string> = {
  // navigation
  Home: "الرئيسية", Clients: "العملاء", Team: "الفريق", Content: "المحتوى", Approvals: "الموافقات",
  "AI Assistant": "المساعد الذكي", Tasks: "المهام", Reports: "التقارير", Media: "الوسائط",
  Meetings: "الاجتماعات", Recommendations: "التوصيات", Campaigns: "الحملات", Notifications: "الإشعارات",
  Settings: "الإعدادات", "Sign out": "تسجيل الخروج", "Sign in": "تسجيل الدخول",
  // common
  Save: "حفظ", Cancel: "إلغاء", Close: "إغلاق", Edit: "تعديل", Delete: "حذف", Create: "إنشاء",
  Add: "إضافة", Remove: "إزالة", Back: "رجوع", Next: "التالي", Previous: "السابق", Search: "بحث",
  Send: "إرسال", Upload: "رفع", Download: "تنزيل", Confirm: "تأكيد", "Choose…": "اختاري…",
  "Saving…": "جاري الحفظ…", "Creating…": "جاري الإنشاء…", "Sending…": "جاري الإرسال…", Loading: "جاري التحميل",
  "← Previous": "السابق →", "Next →": "← التالي", "← All content": "المحتوى كله →",
  "Nothing here.": "ما في شي هون.", Name: "الاسم", Email: "البريد الإلكتروني", Password: "كلمة المرور",
  Status: "الحالة", Type: "النوع", Platform: "المنصة", Client: "العميل", Date: "التاريخ", Language: "اللغة",
  "All clients": "كل العملاء", "All statuses": "كل الحالات", Active: "نشط", Disabled: "معطّل",
  // content & approvals
  "New content": "محتوى جديد", Draft: "مسودة", "In review": "قيد المراجعة", Approved: "تمت الموافقة",
  Scheduled: "مجدول", Published: "منشور", Failed: "فشل", "Changes requested": "مطلوب تعديل",
  Post: "منشور", Reel: "ريل", Story: "ستوري", Text: "النص", Script: "السكربت", Versions: "النسخ",
  "Send for approval": "إرسال للموافقة", Approve: "موافقة", "Request changes": "طلب تعديل", Reject: "رفض",
  "Approval history": "سجل الموافقات", "Manager review": "مراجعة المدير", "Client review": "مراجعة العميل",
  "Mark as published": "تعليم كمنشور", Waiting: "بالانتظار", Rejected: "مرفوض",
  // campaigns
  "New campaign": "حملة جديدة", "Create campaign": "إنشاء حملة", Objective: "الهدف", Budget: "الميزانية",
  Channels: "القنوات", Starts: "تبدأ", Ends: "تنتهي", Planned: "مخطط لها", Paused: "متوقفة", Completed: "مكتملة",
  "Content in this campaign": "المحتوى بهذه الحملة", "No campaigns yet.": "ما في حملات لسا.",
  // tasks / meetings / reports
  "Create task": "إنشاء مهمة", "To do": "للعمل", "In progress": "قيد التنفيذ", Done: "منجزة",
  "My tasks": "مهامي", "New meeting": "اجتماع جديد", Transcript: "النص المفرّغ", Summary: "الملخص",
  "Action items": "بنود العمل", Numbers: "الأرقام", Goals: "الأهداف", "To review": "للمراجعة", Decided: "تم البت فيها",
  // login / portal
  Welcome: "أهلاً", "Welcome back": "أهلاً بعودتك", "Create account": "إنشاء حساب",
  "Sign in to your account": "سجّلي الدخول لحسابك",
    WORKSPACE: "مساحة العمل",
  "COMING SOON": "قريباً",
  "Log out": "تسجيل الخروج",
  "Search clients, content, requests": "ابحثي عن عملاء، محتوى، طلبات",
  "Your agency": "وكالتك",
  User: "مستخدم",
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string; dir: "ltr" | "rtl" };
const I18nContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (s) => s, dir: "ltr" });

function initial(): Lang {
  try { return localStorage.getItem(KEY) === "ar" ? "ar" : "en"; } catch { return "en"; }
}

/* ---------- text translator: swaps visible text, remembers the English original ---------- */
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);
const ATTRS = ["placeholder", "aria-label", "title"] as const;
const textState = new WeakMap<Text, { orig: string; shown: string }>();
const missing = new Set<string>();

function target(orig: string, lang: Lang): string {
  const key = orig.trim();
  if (lang === "en" || !key) return orig;
  const tr = ar[key];
  if (tr === undefined) { if (/[A-Za-z]{2}/.test(key) && key.length < 120) missing.add(key); return orig; }
  return orig.replace(key, tr);
}

function doText(node: Text, lang: Lang) {
  if (node.parentElement && (SKIP.has(node.parentElement.tagName) || node.parentElement.closest("[data-no-i18n]"))) return;
  const now = node.nodeValue ?? "";
  const st = textState.get(node);
  const orig = st && now === st.shown ? st.orig : now; // changed by React → new original
  const shown = target(orig, lang);
  textState.set(node, { orig, shown });
  if (shown !== now) node.nodeValue = shown;
}

function doElement(el: Element, lang: Lang) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v === null) continue;
    const store = `data-i18n-${a}`;
    const saved = el.getAttribute(store);
    const orig = saved !== null && v === el.getAttribute(`${store}-shown`) ? saved : v;
    const shown = target(orig, lang);
    el.setAttribute(store, orig);
    el.setAttribute(`${store}-shown`, shown);
    if (shown !== v) el.setAttribute(a, shown);
  }
}

function walk(root: Node, lang: Lang) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root as Text, lang);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  if (root instanceof Element) doElement(root, lang);
  let n: Node | null = w.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text, lang);
    else doElement(n as Element, lang);
    n = w.nextNode();
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    (window as unknown as Record<string, unknown>).__missingTexts = () => Array.from(missing).sort();

    walk(document.body, lang);
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") walk(r.target, lang);
        else if (r.type === "attributes") walk(r.target, lang);
        else r.addedNodes.forEach((n) => walk(n, lang));
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    return () => obs.disconnect();
  }, [lang, dir]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  };
  const t = (s: string) => (lang === "ar" ? ar[s.trim()] ?? s : s);

    const copyMissing = async () => {
    const list = Array.from(missing).sort().join("\n");
    try { await navigator.clipboard.writeText(list); alert(`Copied ${missing.size} texts`); }
    catch { window.prompt("Copy this:", list); }
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
      {lang === "ar" && (
        <button type="button" data-no-i18n onClick={copyMissing}
          style={{ position: "fixed", bottom: 14, insetInlineEnd: 14, zIndex: 9999, padding: "8px 12px", borderRadius: 8, border: "1px solid #999", background: "#fff", color: "#000", fontSize: 12, cursor: "pointer" }}>
          Copy missing texts
        </button>
      )}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);