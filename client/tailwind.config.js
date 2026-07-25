/** @type {import('tailwindcss').Config} */

/*
 * Colours are semantic, not literal: `bg-content`, `text-ink`, `border-separator`
 * rather than `bg-white`, `text-slate-900`, `border-slate-200`.
 *
 * Each resolves to a CSS variable that index.css redefines under
 * `prefers-color-scheme: dark`, so both appearances come from one set of class
 * names. The alternative — a `dark:` variant on every coloured utility — would
 * have doubled ~430 call sites and made every future page a chance to forget one.
 *
 * Variables hold space-separated RGB channels so Tailwind's opacity modifiers
 * still work: macOS builds its text hierarchy by fading a single ink colour,
 * which is exactly `text-ink/60` and `text-ink/40`.
 */
const channel = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

  // Follows the OS, with no in-app toggle: macOS apps take the system
  // appearance. The `dark:` variant is used only by the hue-coded tier and
  // interaction badges — everything else goes through the tokens below.
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        // Surfaces, back to front.
        window: channel("--c-window"),
        content: channel("--c-content"),
        elevated: channel("--c-elevated"),
        sidebar: channel("--c-sidebar"),

        // One ink colour; hierarchy comes from opacity.
        ink: channel("--c-ink"),

        separator: channel("--c-separator"),
        fill: channel("--c-fill"),

        accent: {
          DEFAULT: channel("--c-accent"),
          hover: channel("--c-accent-hover"),
          ink: channel("--c-accent-ink"),
        },

        danger: channel("--c-danger"),
        // Foreground for text sitting *on* a filled status colour. White in
        // light; near-black in dark, where the status hues are deliberately
        // bright and white-on-amber is unreadable.
        "status-ink": channel("--c-status-ink"),
        warning: channel("--c-warning"),
        success: channel("--c-success"),

        // The tier badges stay hue-coded, so the indigo ramp survives. index.css
        // retunes the ones that need it for dark.
        brand: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          500: "#4F46E5",
          600: "#4338CA",
          700: "#3730A3",
          800: "#312E81",
        },
      },

      fontFamily: {
        // SF on Apple hardware, which is where this gets read most. No webfont:
        // the system stack is instant, and it is what makes a UI feel native.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Inter",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },

      borderRadius: {
        // macOS: ~6px on controls, ~10px on grouped boxes, ~14px on sheets.
        control: "6px",
        box: "10px",
        sheet: "14px",
      },

      boxShadow: {
        // Vibrancy reads as a hairline plus a very soft drop, not a dark blur.
        box: "0 1px 2px rgb(0 0 0 / 0.04), 0 0 0 0.5px rgb(var(--c-separator) / 0.9)",
        popover: "0 12px 32px rgb(0 0 0 / 0.18), 0 0 0 0.5px rgb(var(--c-separator) / 0.9)",
        sheet: "0 24px 64px rgb(0 0 0 / 0.28)",
      },

      backdropBlur: {
        vibrancy: "24px",
      },
    },
  },
  plugins: [],
};
