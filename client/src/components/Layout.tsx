import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
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
  const location = useLocation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close on route change so a back-navigation never leaves the drawer covering
  // the page it navigated to.
  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  // Escape closes it, focus moves into it, and the page behind stops scrolling —
  // the three things a hand-rolled drawer usually forgets.
  useEffect(() => {
    if (!mobileNavOpen) return;

    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButtonRef.current?.focus();
    };
  }, [mobileNavOpen]);

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
              // min-h-11 gives a 44px touch target in the mobile drawer; the
              // desktop sidebar is mouse-driven and can stay compact.
              "flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:min-h-9",
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
          ref={menuButtonRef}
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav"
        >
          <Menu className="h-5 w-5" aria-hidden />
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
          <div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-72 max-w-[85vw] animate-slide-in flex-col bg-white p-4 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <Brand />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">{nav}</div>

            {/* Log out used to live only in the desktop sidebar, which left no way
                to sign out on a phone — the device this gets used on most. */}
            {user && <UserFooter user={user} onLogout={logout} />}
          </div>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar — the primary design target is a laptop browser. */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
          <Brand />

          <div className="mt-6 flex-1">{nav}</div>

          {user && <UserFooter user={user} onLogout={logout} />}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Shared by the desktop sidebar and the mobile drawer so the two can't drift. */
function UserFooter({
  user,
  onLogout,
}: {
  user: { name: string; role: string };
  onLogout: () => Promise<void>;
}) {
  return (
    <div className="border-t border-slate-200 pt-3">
      <div className="flex items-center gap-2.5 px-1">
        <Avatar label={initials(user.name)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs capitalize text-slate-500">{user.role.toLowerCase()}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void onLogout()}
        className="mt-2 flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:min-h-9"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        Log out
      </button>
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
