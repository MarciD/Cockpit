"use client";

import { Box, Flex, Image, Text, chakra } from "@chakra-ui/react";
import type { IdeaDto } from "../types";
import { minutesLabel } from "./lib";

interface IdeaCardProps {
  idea: IdeaDto;
  onPick: () => void;
  busy?: boolean;
}

/** Photo, the pitch in the Chef's voice, and the facts in mono. */
export function IdeaCard({ idea, onPick, busy }: IdeaCardProps) {
  return (
    <chakra.button
      type="button"
      onClick={onPick}
      disabled={busy}
      layerStyle="raised"
      borderRadius="small"
      p="2.5"
      textAlign="left"
      w="100%"
      cursor={busy ? "progress" : "pointer"}
      color="fg"
    >
      <Flex gap="2.5" align="flex-start">
        {idea.image ? (
          <Image
            src={idea.image}
            alt=""
            boxSize="46px"
            borderRadius="7px"
            objectFit="cover"
            flexShrink={0}
          />
        ) : null}
        <Box minW="0" flex="1">
          <Text fontSize="12.5px" fontWeight="semibold" lineHeight="1.3">
            {idea.title}
          </Text>
          <Text fontSize="11.5px" color="fg.muted" lineHeight="1.35" mt="0.5">
            {idea.pitch}
          </Text>
          <Flex gap="2" mt="1" wrap="wrap">
            <Text textStyle="meta">
              {minutesLabel(idea.minutes, idea.activeMinutes)}
            </Text>
            <Text textStyle="meta">{idea.difficulty}</Text>
            {idea.devices.length ? (
              <Text textStyle="meta">{idea.devices.join(" · ")}</Text>
            ) : null}
          </Flex>
        </Box>
      </Flex>
    </chakra.button>
  );
}
