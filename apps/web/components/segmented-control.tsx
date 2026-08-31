"use client";

import { Flex, chakra } from "@chakra-ui/react";

interface SegmentedControlProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
}

/** The Atelier `.seg` — an inset neumorphic track; the active option pops. */
export function SegmentedControl({
  value,
  onChange,
  options,
  ariaLabel,
}: SegmentedControlProps) {
  return (
    <Flex
      layerStyle="inset"
      borderRadius="control"
      p="3px"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <chakra.button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            layerStyle={active ? "raised" : undefined}
            px="15px"
            py="8px"
            borderRadius="18px"
            fontFamily="body"
            fontSize="10px"
            fontWeight="medium"
            letterSpacing="0.1em"
            textTransform="uppercase"
            color={active ? "fg" : "fg.muted"}
            cursor="pointer"
            transition="color 0.15s ease"
          >
            {opt.label}
          </chakra.button>
        );
      })}
    </Flex>
  );
}
