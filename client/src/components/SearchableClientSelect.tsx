import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useClients } from "../hooks/queries";
import { TierBadge } from "./TierBadge";

interface SearchableClientSelectProps {
  value: string | null;
  onChange: (clientId: string | null) => void;
  placeholder?: string;
  allowNone?: boolean;
  id?: string;
}

/** Type-to-filter client picker — faster than a native select once there are 20+ clients. */
export function SearchableClientSelect({
  value,
  onChange,
  placeholder = "Search clients…",
  allowNone = true,
  id,
}: SearchableClientSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: clients = [], isLoading } = useClients();

  const selected = clients.find((c) => c.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.businessName.toLowerCase().includes(q));
  }, [clients, query]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? "truncate text-ink" : "truncate text-ink/65"}>
          {selected ? selected.businessName : "No client"}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink/65" aria-hidden />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-separator/70 bg-content shadow-lg">
          <div className="flex items-center gap-2 border-b border-separator/50 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-ink/65" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full border-0 p-0 text-sm outline-none placeholder:text-ink/65 focus:ring-0"
              autoFocus
            />
          </div>

          <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
            {allowNone && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink/70 hover:bg-fill/8"
                >
                  No client
                  {value === null && <Check className="h-4 w-4 text-accent" aria-hidden />}
                </button>
              </li>
            )}

            {isLoading && <li className="px-3 py-2 text-sm text-ink/65">Loading…</li>}

            {!isLoading && filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink/65">No clients match “{query}”</li>
            )}

            {filtered.map((client) => (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(client.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-fill/8"
                >
                  <span className="truncate text-ink">{client.businessName}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <TierBadge tier={client.currentTier} />
                    {value === client.id && <Check className="h-4 w-4 text-accent" aria-hidden />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
