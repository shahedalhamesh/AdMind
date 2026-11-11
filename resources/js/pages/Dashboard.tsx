import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Link } from "react-router-dom";
import { getUser } from "../services/auth";
import { listKnowledge, loadLocalProfile } from "../services/memory";

type SetupStep = {
  id: string;
  title: string;
  description: string;
  icon: string;
  action: string;
  to: string;
  done: boolean;
};

type StatCard = {
  label: string;
  hint: string;
  icon: string;
  to: string;
};

const statCards: StatCard[] = [
  { label: "Active Campaigns", hint: "Starts after your first campaign", icon: "solar:chart-2-linear", to: "/my-campaigns" },
  { label: "Content Approvals", hint: "New content to review", icon: "solar:document-add-linear", to: "/my-content" },
  { label: "Active Requests", hint: "Ask your agency for work", icon: "solar:clipboard-list-linear", to: "/my-requests" },
  { label: "Unread Messages", hint: "Messages from your agency", icon: "solar:chat-round-dots-linear", to: "/messages" },
];

export default function Dashboard() {
  const [docCount, setDocCount] = useState<number>(0);

  const firstName = getUser()?.name?.split(" ")[0] ?? "there";

  // Brand profile (semantic memory): complete when all required fields are filled.
  const profile = loadLocalProfile();
  const requiredValues = profile
    ? [profile.businessName, profile.industry, profile.description, profile.audience, profile.goal]
    : [];
  const profileDone = requiredValues.length === 5 && requiredValues.every((v) => v.trim() !== "");

  // Company documents (knowledge base): done when at least one file is uploaded.
  useEffect(() => {
    listKnowledge()
      .then((docs) => setDocCount(docs.length))
      .catch(() => setDocCount(0)); // backend not ready yet
  }, []);

  const steps: SetupStep[] = [
    {
      id: "brand",
      title: "Complete your brand profile",
      description: "Business name, audience, goals, and brand voice. Your agency and AI team rely on this.",
      icon: "solar:shop-linear",
      action: profileDone ? "Edit profile" : "Start profile",
      to: "/my-brand",
      done: profileDone,
    },
    {
      id: "knowledge",
      title: "Upload company documents",
      description: "Price lists, policies, and offers (PDF, DOCX, TXT) so your team knows your business.",
      icon: "solar:document-text-linear",
      action: docCount > 0 ? "Manage documents" : "Upload documents",
      to: "/my-brand",
      done: docCount > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progressPercent = (doneCount / steps.length) * 100;
  const allDone = doneCount === steps.length;

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting */}
      <section>
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome, {firstName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {allDone
            ? "Your workspace is ready. Here is what is happening with your agency."
            : "Finish two quick steps so your agency can start working for you."}
        </p>
      </section>

      {/* Setup (hidden once everything is done) */}
      {!allDone && (
        <section aria-label="Workspace setup" className="rounded-xl border border-border bg-card shadow-theme">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
            <h2 className="font-heading text-base font-bold">Get started</h2>
            <div className="flex items-center gap-3 text-sm">
              <div
                className="h-2 w-32 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={Math.round(progressPercent)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-tertiary transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <span className="text-muted-foreground">
                {doneCount} of {steps.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
            {steps.map((step) => (
              <Link
                key={step.id}
                to={step.to}
                className={`group flex gap-4 rounded-xl border p-5 transition-colors ${
                  step.done ? "border-tertiary" : "border-border hover:border-secondary"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    step.done ? "bg-tertiary text-tertiary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon icon={step.done ? "solar:check-circle-bold" : step.icon} width="20" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading text-base font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">
                    {step.action}
                    <Icon icon="solar:arrow-right-linear" width="16" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Stats */}
      <section aria-label="Overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="rounded-xl border border-border bg-card p-5 shadow-theme transition-colors hover:border-secondary"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-3 font-heading text-3xl font-bold">—</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon icon={card.icon} width="20" />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{card.hint}</p>
          </Link>
        ))}
      </section>

      {/* Needs attention */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-theme">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold">Needs your attention</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Approvals and requests that are waiting for your response.
            </p>
          </div>
          <Link to="/my-requests" className="inline-flex items-center gap-1 text-sm font-semibold hover:opacity-70">
            View requests
            <Icon icon="solar:arrow-right-linear" width="16" />
          </Link>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon icon="solar:inbox-linear" width="24" />
          </div>
          <p className="mt-4 text-sm font-semibold">Nothing needs your attention yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            When your agency sends content or asks a question, it will show up here.
          </p>
        </div>
      </section>
    </div>
  );
}