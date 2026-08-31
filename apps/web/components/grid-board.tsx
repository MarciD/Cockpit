"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { useCallback, useMemo, useRef, useState } from "react";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import type { Layout, LayoutItem, ResponsiveLayouts } from "react-grid-layout";
import { getWidget } from "@cockpit/widgets";
import type { WidgetInstance, WidgetLayoutSpec } from "@cockpit/widget-sdk";
import { WidgetCard } from "./widget-card";

const COLS = { lg: 12, md: 10, sm: 6, xs: 1, xxs: 1 };
const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const MARGIN: [number, number] = [14, 14];
const PADDING: [number, number] = [0, 0];
const ROW_HEIGHT = 40;
/** Drag starts only from a widget's `.wgrip` handle (shown in EDIT mode). */
const DRAG_HANDLE = ".wgrip";
const FALLBACK_SPEC: WidgetLayoutSpec = { defaultW: 4, defaultH: 6 };

/** A widget can opt out of the phone layout entirely via `layout.mobileHidden`. */
function isMobileHidden(inst: WidgetInstance): boolean {
  return getWidget(inst.widgetId)?.layout.mobileHidden === true;
}

/**
 * Active breakpoint for a container width, matching react-grid-layout's own
 * rule (the largest breakpoint whose min-width is strictly below `width`).
 * We feed RGL this same `width`, so this never disagrees with what it renders —
 * and it avoids the stale-state bug of reading the breakpoint from a callback.
 */
function resolveBreakpoint(
  width: number,
  breakpoints: Record<string, number>,
): string {
  const ascending = Object.keys(breakpoints).sort(
    (a, b) => breakpoints[a] - breakpoints[b],
  );
  let match = ascending[0];
  for (const name of ascending) {
    if (width > breakpoints[name]) match = name;
  }
  return match;
}

/** Flow widgets left-to-right at their default sizes when no layout is saved. */
function buildDefaultLayout(
  instances: WidgetInstance[],
  cols: number,
): LayoutItem[] {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  const out: LayoutItem[] = [];
  for (const inst of instances) {
    const spec = getWidget(inst.widgetId)?.layout ?? FALLBACK_SPEC;
    const w = Math.min(spec.defaultW, cols);
    const h = spec.defaultH;
    if (x + w > cols) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    out.push({
      i: inst.instanceId,
      x,
      y,
      w,
      h,
      minW: spec.minW,
      minH: spec.minH,
    });
    x += w;
    rowHeight = Math.max(rowHeight, h);
  }
  return out;
}

/**
 * Single, full-width mobile stack. Widgets follow the desktop (`lg`) reading
 * order — top-to-bottom, then left-to-right — each a full column wide (`w:1`,
 * which also overrides desktop `minW`s that exceed one column) and as tall as
 * its `mobileH` (falling back to `defaultH`). Generated per render from the
 * current desktop order and injected into RGL — never persisted.
 */
function buildMobileLayout(
  instances: WidgetInstance[],
  lgLayout: Layout,
): LayoutItem[] {
  const pos = new Map(lgLayout.map((item) => [item.i, item]));
  const ordered = instances
    .filter((inst) => !isMobileHidden(inst))
    .sort((a, b) => {
      const pa = pos.get(a.instanceId);
      const pb = pos.get(b.instanceId);
      // Widgets absent from the desktop layout (just added) sink to the bottom.
      if (!pa || !pb) return pa ? -1 : pb ? 1 : 0;
      return pa.y - pb.y || pa.x - pb.x;
    });
  let y = 0;
  const out: LayoutItem[] = [];
  for (const inst of ordered) {
    const spec = getWidget(inst.widgetId)?.layout ?? FALLBACK_SPEC;
    const h = spec.mobileH ?? spec.defaultH;
    out.push({ i: inst.instanceId, x: 0, y, w: 1, h, minW: 1, maxW: 1 });
    y += h;
  }
  return out;
}

interface GridBoardProps {
  profileId: string;
  instances: WidgetInstance[];
  initialLayouts: Record<string, unknown>;
  editing: boolean;
  onConfigure?: (instance: WidgetInstance) => void;
  onRemove?: (instanceId: string) => void;
}

export function GridBoard({
  profileId,
  instances,
  initialLayouts,
  editing,
  onConfigure,
  onRemove,
}: GridBoardProps) {
  const { width, mounted, containerRef } = useContainerWidth();
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => {
    const seeded: ResponsiveLayouts = {
      ...(initialLayouts as ResponsiveLayouts),
    };
    if (!seeded.lg || seeded.lg.length === 0) {
      seeded.lg = buildDefaultLayout(instances, COLS.lg);
    }
    return seeded;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived from the same width we hand RGL, so it matches what RGL renders.
  const activeBreakpoint = resolveBreakpoint(width, BREAKPOINTS);
  const isMobile = activeBreakpoint === "xs" || activeBreakpoint === "xxs";
  // Phones are read-only: editing (drag/resize/remove) is a desktop activity.
  const canEdit = editing && !isMobile;

  // Phones always show the generated single-column stack, overriding any stale
  // saved xs/xxs rows (built for the old multi-column counts).
  const gridLayouts = useMemo<ResponsiveLayouts>(() => {
    const mobile = buildMobileLayout(instances, layouts.lg ?? []);
    return { ...layouts, xs: mobile, xxs: mobile };
  }, [instances, layouts]);

  const persist = useCallback(
    (bp: string, layout: Layout) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void fetch("/api/layout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profileId, breakpoint: bp, layout }),
        });
      }, 600);
    },
    [profileId],
  );

  const handleLayoutChange = useCallback(
    (layout: Layout, all: ResponsiveLayouts) => {
      setLayouts(all);
      // Never write layout rows from a phone; desktop persists per breakpoint.
      if (canEdit) persist(activeBreakpoint, layout);
    },
    [canEdit, activeBreakpoint, persist],
  );

  return (
    <div ref={containerRef} style={{ minHeight: 200 }}>
      {mounted ? (
        <ResponsiveGridLayout
          width={width}
          className="cockpit-grid"
          layouts={gridLayouts}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          margin={MARGIN}
          containerPadding={PADDING}
          dragConfig={{ enabled: canEdit, handle: DRAG_HANDLE }}
          resizeConfig={{ enabled: canEdit }}
          onLayoutChange={handleLayoutChange}
        >
          {(isMobile
            ? instances.filter((inst) => !isMobileHidden(inst))
            : instances
          ).map((inst) => {
            const def = getWidget(inst.widgetId);
            return (
              <div key={inst.instanceId}>
                {def ? (
                  <WidgetCard
                    def={def}
                    instance={inst}
                    editing={canEdit}
                    onConfigure={onConfigure}
                    onRemove={onRemove}
                  />
                ) : null}
              </div>
            );
          })}
        </ResponsiveGridLayout>
      ) : null}
    </div>
  );
}
