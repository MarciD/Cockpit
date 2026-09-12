"use client";

import { Flex, Text } from "@chakra-ui/react";
import type { SourceId, SourceStatusDto } from "../types";
import { formatAge } from "./lib";

const NAMES: Record<SourceId, string> = {
  xdccinfo: "xdcc.info",
  xdccsearch: "xdccsearch",
  nibl: "nibl",
};

/** "xdcc.info 200 of 1552" — what the page holds of what the index has. */
export function describeSource(s: SourceStatusDto): string {
  const name = NAMES[s.id];
  const scope =
    s.total !== null && s.total > s.count
      ? `${s.count} of ${s.total}`
      : `${s.count}`;
  if (s.ok) return `${name} ${scope}`;
  if (s.count > 0) return `${name} ${scope}, from ${formatAge(s.cachedAt)} ago`;
  return `${name} failed`;
}

interface SourceStatusProps {
  sources: SourceStatusDto[];
  /** Only what went wrong — for the tile, where a healthy line is noise. */
  problemsOnly?: boolean;
}

/** One meta line per search: how much of each index the page covers, and which one failed. */
export function SourceStatus({ sources, problemsOnly }: SourceStatusProps) {
  const shown = problemsOnly ? sources.filter((s) => !s.ok) : sources;
  if (shown.length === 0) return null;
  return (
    <Flex gap="2" wrap="wrap" align="center">
      {shown.map((s) => (
        <Text
          key={s.id}
          textStyle="meta"
          color={s.ok ? undefined : "warning"}
          title={s.error ?? "packs this search holds, of what the index has"}
        >
          {describeSource(s)}
        </Text>
      ))}
    </Flex>
  );
}
