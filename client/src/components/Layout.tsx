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
              // .sidebar-item carries the 44px touch target and the compact
              // desktop height; see index.css.
              "sidebar-item",
              isActive ? "sidebar-item-active" : "sidebar-item-idle"
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* macOS tints sidebar glyphs with the accent when idle, and drops
                  them to the selection's foreground colour when active. */}
              <item.icon
                className={clsx("h-4 w-4 shrink-0", !isActive && "text-accent")}
                aria-hidden
              />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-window">
      {/* Mobile toolbar — Cole updates things from his phone after calls. Uses
          the same blurred material a macOS window's titlebar does, so content
          scrolls under it rather than colliding with it. */}
      <header className="toolbar flex items-center justify-between px-4 py-2 lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-control text-ink/70 hover:bg-fill/15"
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <span className="text-sm font-semibold text-ink">MiDigitalExpansion</span>
        {user && <Avatar label={initials(user.name)} className="h-7 w-7" />}
      </header>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="material relative flex h-full w-72 max-w-[85vw] animate-slide-in flex-col p-3 shadow-sheet"
          >
            <div className="mb-4 flex items-center justify-between">
              <Brand />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-control text-ink/65 hover:bg-fill/15"
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
        {/*
          Desktop sidebar. A translucent vibrancy material rather than an opaque
          panel — the defining surface of a macOS window, and the reason the
          window background sits behind everything instead of white.
        */}
        <aside className="material sticky top-0 hidden h-screen w-[15rem] shrink-0 flex-col border-r border-separator/60 p-3 lg:flex">
          <Brand />

          <div className="mt-5 flex-1">
            <p className="sidebar-heading">Workspace</p>
            {nav}
          </div>

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
    <div className="border-t border-separator/70 pt-3">
      <div className="flex items-center gap-2.5 px-1">
        <Avatar label={initials(user.name)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="truncate text-xs capitalize text-ink/70">{user.role.toLowerCase()}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void onLogout()}
        className="mt-2 flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink/70 hover:bg-fill/15 hover:text-ink lg:min-h-9"
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
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-ink">
        Mi
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-ink">MiDigitalExpansion</p>
        <p className="text-xs text-ink/65">CRM</p>
      </div>
    </div>
  );
}
