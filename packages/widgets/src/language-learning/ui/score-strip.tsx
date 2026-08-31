"use client";

import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import type { ScoreSummary } from "../types";

interface ScoreStripProps {
  summary: ScoreSummary;
}

const RING = 44;
const R = 18;
const C = 2 * Math.PI * R;

function Ring({ progress, label }: { progress: number; label: string }) {
  const offset = C * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <Box
      position="relative"
      w={`${RING}px`}
      h={`${RING}px`}
      color="accent.solid"
      flexShrink={0}
    >
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          fill="none"
          stroke="rgba(120,95,60,.18)"
          strokeWidth={5}
        />
        <circle
          cx={RING / 2}
          cy={RING / 2}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        />
      </svg>
      <Box
        position="absolute"
        inset="0"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text textStyle="data" fontSize="2xs" color="fg" fontWeight="medium">
          {label}
        </Text>
      </Box>
    </Box>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 76;
  const h = 22;
  const max = Math.max(1, ...values);
  const n = values.length;
  const step = n > 1 ? w / (n - 1) : w;
  const points = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(h - (v / max) * (h - 3) - 1.5).toFixed(1)}`,
    )
    .join(" ");
  return (
    <Box color="accent.solid" flexShrink={0} aria-hidden>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.85}
        />
      </svg>
    </Box>
  );
}

export function ScoreStrip({ summary }: ScoreStripProps) {
  const pct = Math.round(summary.accuracy * 100);
  return (
    <HStack gap="3" w="100%" align="center">
      <Ring
        progress={summary.goalProgress}
        label={`${summary.itemsAnswered}/${summary.goalItems}`}
      />
      <Stack gap="0.5" flex="1" minW="0">
        <Text fontSize="xs" color="fg">
          {summary.goalMet ? "Goal reached today" : "Today's practice"}
        </Text>
        <Text textStyle="meta">
          {summary.itemsAnswered > 0 ? `${pct}% accuracy` : "not started"}
          {summary.streakDays > 0 ? ` · 🔥 ${summary.streakDays}d` : ""}
        </Text>
      </Stack>
      <Sparkline values={summary.spark} />
    </HStack>
  );
}
