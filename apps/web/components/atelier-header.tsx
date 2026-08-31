"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Heading,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { SegmentedControl } from "./segmented-control";

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const pad = (n: number): string => String(n).padStart(2, "0");

interface AtelierHeaderProps {
  name: string;
  kind: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onAdd: () => void;
}

/** The desk's top bar: rust logo + name + date, live clock, VIEW/EDIT, add. */
export function AtelierHeader({
  name,
  kind,
  editing,
  onEditingChange,
  onAdd,
}: AtelierHeaderProps) {
  // null on the server and first client render (matching markup, no hydration
  // mismatch); the real time arrives after mount and ticks every second.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const clock = now
    ? `${pad(now.getHours())}:${pad(now.getMinutes())}`
    : "--:--";
  const date = now
    ? `${DAYS[now.getDay()]} ${pad(now.getDate())} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`
    : "";
  const sub = date ? `${kind.toUpperCase()} · ${date}` : kind.toUpperCase();

  return (
    <Flex
      align="center"
      justify="space-between"
      gap="4"
      mb={{ base: "3", md: "5" }}
    >
      <HStack gap="3" minW="0">
        <Box
          bg="accent"
          boxSize="28px"
          borderRadius="full"
          boxShadow="raisedSm"
          flexShrink={0}
        />
        <Stack gap="0.5" minW="0">
          <Heading
            fontSize="16px"
            fontWeight="medium"
            letterSpacing="0.02em"
            lineClamp={1}
          >
            {name}
          </Heading>
          <Text textStyle="label" suppressHydrationWarning>
            {sub}
          </Text>
        </Stack>
      </HStack>

      <HStack gap="3" flexShrink={0} display={{ base: "none", md: "flex" }}>
        <Text
          textStyle="data"
          fontSize="17px"
          color="fg"
          suppressHydrationWarning
        >
          {clock}
        </Text>
        <SegmentedControl
          ariaLabel="View or edit the layout"
          value={editing ? "edit" : "view"}
          onChange={(v) => onEditingChange(v === "edit")}
          options={[
            { value: "view", label: "View" },
            { value: "edit", label: "Edit" },
          ]}
        />
        <chakra.button
          type="button"
          aria-label="Add widget"
          onClick={onAdd}
          layerStyle="raised"
          boxSize="38px"
          borderRadius="full"
          color="fg"
          fontSize="20px"
          lineHeight="1"
          cursor="pointer"
          display="flex"
          alignItems="center"
          justifyContent="center"
          _active={{ boxShadow: "inset" }}
        >
          +
        </chakra.button>
      </HStack>
    </Flex>
  );
}
