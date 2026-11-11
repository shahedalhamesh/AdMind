import { useState } from "react";
import { Icon } from "@iconify/react";
import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useTheme } from "../components/ThemeContext";

type NavItem = { to: string; label: string; icon: string } | "divider";

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "solar:widget-5-linear" },
  { to: "/my-brand", label: "My Brand", icon: "solar:shop-linear" },
  { to: "/my-requests", label: "My Requests", icon: "solar:clipboard-list-linear" },
  { to: "/my-content", label: "My Content", icon: "solar:document-text-linear" },
  "divider",
  { to: "/content-calendar", label: "Content Calendar", icon: "solar:calendar-linear" },
  { to: "/my-campaigns", label: "My Campaigns", icon: "solar:chart-2-linear" },
  { to: "/analytics-reports", label: "Analytics & Reports", icon: "solar:graph-new-linear" },
  { to: "/messages", label: "Messages", icon: "solar:chat-round-dots-linear" },
  "divider",
  { to: "/ai-assistant", label: "AI Assistant", icon: "solar:magic-stick-3-linear" },
];

export default function ClientLayout() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = (): void => {
    // Later: call the Laravel logout API and clear the token here.
    navigate("/login");
  };

  return (
    <div className="min-h-screen w-full bg-background font-sans text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto flex h-20 max-w-[1600px] items-center gap-4 px-5 lg:px-8">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-tertiary text-tertiary-foreground shadow-theme">
              <Icon icon="solar:chart-square-bold-duotone" width="23" />
            </div>
            <div className="hidden sm:block">
              <p className="font-heading text-lg font-bold tracking-tight">AdMind</p>
              <p className="text-xs text-muted-foreground">Client workspace</p>
            </div>
          </Link>

          <label className="ml-auto hidden w-full max-w-xs items-center gap-3 rounded-lg border border-input bg-card px-3 py-2 text-muted-foreground xl:flex">
            <Icon icon="solar:magnifer-linear" width="18" />
            <input
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search your workspace"
              aria-label="Search your workspace"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>

          <div className="ml-auto flex items-center gap-2 xl:ml-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted cursor-pointer"
            >
              <Icon icon={theme === "dark" ? "lucide:sun" : "lucide:moon"} width="20" />
            </button>

            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted cursor-pointer"
              aria-label="Open notifications"
            >
              <Icon icon="solar:bell-linear" width="20" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-tertiary"></span>
            </button>

            <button
              type="button"
              className="hidden h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted md:inline-flex cursor-pointer"
              aria-label="Open support"
            >
              <Icon icon="solar:question-circle-linear" width="18" />
              <span>Help</span>
            </button>

            <div className="flex items-center gap-2 rounded-lg p-1.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon icon="solar:user-linear" width="17" />
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold">Your profile</p>
                <p className="text-xs text-muted-foreground">Client account</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted cursor-pointer"
            >
              <Icon icon="solar:logout-2-linear" width="20" />
            </button>
          </div>
        </div>

        <nav className="border-t border-border" aria-label="Client dashboard navigation">
          <div className="mx-auto flex max-w-[1600px] items-center gap-1 overflow-x-auto px-5 py-3 lg:px-8">
            {navItems.map((item, index) =>
              item === "divider" ? (
                <span key={`divider-${index}`} className="mx-1 h-5 w-px shrink-0 bg-border"></span>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-tertiary text-tertiary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`
                  }
                >
                  <Icon icon={item.icon} width="18" />
                  <span>{item.label}</span>
                </NavLink>
              )
            )}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}