"use client";

import { chakra } from "@chakra-ui/react";

interface ChipProps {
  label: string;
  active?: boolean;
  negative?: boolean;
  onClick?: () => void;
  title?: string;
}

/** The one chip used everywhere in this widget: on, off, or struck-through. */
export function Chip({ label, active, negative, onClick, title }: ChipProps) {
  return (
    <chakra.button
      type="button"
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      title={title}
      layerStyle={active ? undefined : "raised"}
      bg={active ? "accent.solid" : undefined}
      color={active ? "accent.fg" : negative ? "fg.muted" : "fg"}
      textDecoration={negative ? "line-through" : undefined}
      px="3"
      py="1.5"
      borderRadius="pill"
      fontSize="12px"
      lineHeight="1.2"
      cursor={onClick ? "pointer" : "default"}
      flexShrink={0}
    >
      {label}
    </chakra.button>
  );
}
