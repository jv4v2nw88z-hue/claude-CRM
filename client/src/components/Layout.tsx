import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import {
  BarChart3,
  Building2,
  CheckSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  TrendingUp,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { initials } from "../lib/format";
import { Avatar } from "./ui";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clients", label: "Clients", icon: Building2, end: false },
  { to: "/deals", label: "Deals", icon: TrendingUp, end: false },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, end: false },
  { to: "/revenue", label: "Revenue", icon: BarChart3, end: false },
  { to: "/settings/automations", label: "Automations", icon: Settings, end: false },
];

export function Layout() {
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMobileNavOpen(false)}
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-700 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )
          }
        >
          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile top bar — Cole updates things from his phone after calls. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold text-slate-900">MiDigitalExpansion</span>
        {user && <Avatar label={initials(user.name)} className="h-7 w-7" />}
      </header>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="relative h-full w-64 animate-slide-in bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar — the primary design target is a laptop browser. */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
          <Brand />

          <div className="mt-6 flex-1">{nav}</div>

          {user && (
            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center gap-2.5 px-1">
                <Avatar label={initials(user.name)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                  <p className="truncate text-xs capitalize text-slate-500">
                    {user.role.toLowerCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Log out
              </button>
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">
        Mi
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900">MiDigitalExpansion</p>
        <p className="text-xs text-slate-400">CRM</p>
      </div>
    </div>
  );
}
