import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

/**
 * "Atelier" — warm clay/cream neumorphism (soft-UI). Every surface is a warm
 * gradient panel raised by a dual shadow (warm-brown drop + white top-left
 * highlight). Helvetica Neue for text, mono for all data. Colour is a single
 * terracotta accent that cascades from the active desk's hue via `--accent`.
 *
 * Neumorphism lives in `layerStyles` (gradient bg + shadow + radius applied via
 * `layerStyle="tile|raised|inset"`). Gradients are NOT color tokens in Chakra
 * v3 — never do `bg="tile"`; use the layerStyle.
 */
const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        body: { value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
        heading: { value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
        mono: {
          value:
            "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, monospace",
        },
      },
      radii: {
        tile: { value: "13px" }, // .wg card
        control: { value: "22px" }, // .seg pill / composer
        pill: { value: "22px" }, // count pills, FAB
        dialog: { value: "22px" }, // assistant dialog / modal
        small: { value: "9px" }, // catalog rows, rail tiles
        checkbox: { value: "4px" }, // .box (todo / config checkbox)
      },
      shadows: {
        // Neumorphic dual shadow: warm-brown drop + white top-left highlight.
        panel: {
          value:
            "2px 3px 8px rgba(120,95,60,.11), -2px -2px 6px rgba(255,255,255,.65)",
        },
        panelHover: {
          value:
            "3px 4px 12px rgba(120,95,60,.15), -2px -2px 7px rgba(255,255,255,.70)",
        },
        raisedSm: {
          value:
            "1px 2px 5px rgba(120,95,60,.13), -1px -1px 4px rgba(255,255,255,.60)",
        },
        inset: {
          value:
            "inset 2px 2px 5px rgba(120,95,60,.14), inset -2px -2px 5px rgba(255,255,255,.60)",
        },
        dialog: {
          value:
            "0 18px 50px rgba(60,45,30,.28), -2px -2px 8px rgba(255,255,255,.50)",
        },
      },
    },
    semanticTokens: {
      colors: {
        // canvas + surfaces (warm creams)
        bg: { value: "#e8e1d3" },
        "bg.panel": { value: "#f0ebe0" },
        "bg.subtle": { value: "#eae4d7" },
        "bg.muted": { value: "#e2dccd" },
        "bg.inset": { value: "#e6e0d2" },
        "bg.rail": { value: "rgba(243,238,229,0.72)" },
        // foreground (warm greys)
        fg: { value: "#2b2721" }, // titles / body / essential text
        "fg.muted": { value: "#6f6a5f" }, // secondary + informational data
        "fg.faint": { value: "#9a988e" }, // DECORATIVE ONLY (eyebrows, dividers)
        // hairlines
        border: { value: "#d9d2c4" },
        "border.strong": { value: "#c7bfad" },
        // accent — cascades via the native --accent var (see profile-view); rust fallback
        accent: { value: "var(--accent, #d0552f)" },
        "accent.solid": {
          // 72/28 keeps every desk hue ≥ 4.5:1 (white-on-solid pills AND
          // solid-as-text on the cream panel) — verified across all hues.
          value: "color-mix(in srgb, var(--accent, #d0552f) 72%, #3a1e12)",
        },
        "accent.fg": { value: "#ffffff" },
        "accent.tint": {
          value: "color-mix(in srgb, var(--accent, #d0552f) 14%, transparent)",
        },
        link: { value: "#c24a24" },
        "link.hover": { value: "#e8552d" },
        // status (shape + colour; never colour-only)
        "status.review": { value: "var(--accent, #d0552f)" },
        "status.waiting": { value: "#c99a3e" },
        "status.merged": { value: "#4b7d52" },
        "status.closed": { value: "#9a988e" },
        // semantic feedback
        danger: { value: "#b4453c" },
        "danger.fg": { value: "#ffffff" },
        success: { value: "#4b7d52" },
        warning: { value: "#c99a3e" },
      },
    },
    textStyles: {
      // .wl eyebrows — decorative uppercase micro-labels
      label: {
        value: {
          fontFamily: "mono",
          fontSize: "2xs",
          fontWeight: "medium",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "fg.faint",
        },
      },
      // clock / temps / ids / counts — tabular numerals
      data: {
        value: {
          fontFamily: "mono",
          fontVariantNumeric: "tabular-nums",
        },
      },
      // row meta that carries information (source · time, iid · repo, keys)
      meta: {
        value: {
          fontFamily: "mono",
          fontSize: "2xs",
          color: "fg.muted",
          fontVariantNumeric: "tabular-nums",
        },
      },
    },
    layerStyles: {
      tile: {
        value: {
          background: "linear-gradient(145deg,#f3eee5,#eae4d7)",
          boxShadow: "panel",
          borderRadius: "tile",
        },
      },
      tileHover: {
        value: {
          background: "linear-gradient(145deg,#f5f0e8,#ece6d9)",
          boxShadow: "panelHover",
        },
      },
      raised: {
        value: {
          background: "linear-gradient(145deg,#f6f2ea,#e9e3d6)",
          boxShadow: "raisedSm",
          borderRadius: "control",
        },
      },
      inset: {
        value: {
          background: "linear-gradient(145deg,#e6e0d2,#f6f2ea)",
          boxShadow: "inset",
          borderRadius: "control",
        },
      },
    },
  },
  globalCss: {
    "html, body": { height: "100%" },
    body: {
      margin: 0,
      color: "fg",
      fontFamily: "body",
      background: "linear-gradient(165deg, #efe9dd 0%, #e2dccd 100%)",
      backgroundAttachment: "fixed",
      minHeight: "100dvh",
    },
    "::selection": {
      background: "color-mix(in srgb, #d0552f 18%, transparent)",
    },
    // NOTE: the focus ring, react-grid-layout placeholder/handle overrides and
    // the reduced-motion rule live in app/globals.css (an un-layered stylesheet)
    // so they reliably beat Chakra's cascade layers and the un-layered RGL
    // vendor CSS — and to sidestep Chakra's typed globalCss (no nested selector
    // under @media).
  },
});

export const system = createSystem(defaultConfig, config);
