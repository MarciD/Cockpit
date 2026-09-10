"use client";

import { Box, Flex, Image, Stack, Text } from "@chakra-ui/react";
import type { TechniqueDto } from "../types";
import { Chip } from "./chips";

interface TechniqueCardProps {
  card: TechniqueDto;
  onIdeas: () => void;
  onAsk: () => void;
}

/** Videos first, because a cut is best seen; then the card in the Chef's voice. */
export function TechniqueCard({ card, onIdeas, onAsk }: TechniqueCardProps) {
  return (
    <Stack gap="3">
      <Flex justify="space-between" align="baseline" gap="3" wrap="wrap">
        <Text textStyle="label">technik · {card.query}</Text>
        <Text textStyle="meta">
          {card.videos.length ? `${card.videos.length} videos` : "keine videos"}
          {card.image ? " · pexels" : ""}
        </Text>
      </Flex>

      <Text fontSize="19px" fontWeight="medium" lineHeight="1.25">
        {card.title}
      </Text>

      {card.videos.length || card.image ? (
        <Flex gap="2.5" wrap="wrap">
          {card.videos.map((video) => (
            <Box
              key={video.url}
              as="iframe"
              // @ts-expect-error -- Chakra passes iframe attributes through
              src={video.embedUrl}
              title={video.title}
              allow="encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              w={{ base: "100%", md: "260px" }}
              h="150px"
              border="0"
              borderRadius="9px"
              boxShadow="raisedSm"
            />
          ))}
          {card.image ? (
            <Image
              src={card.image}
              alt=""
              boxSize="150px"
              borderRadius="9px"
              objectFit="cover"
              boxShadow="raisedSm"
            />
          ) : null}
        </Flex>
      ) : (
        <Text textStyle="meta">
          Für Videos einen YouTube-Key in den Einstellungen hinterlegen.
        </Text>
      )}

      <Flex gap="4" wrap="wrap">
        <Box minW="180px">
          <Text textStyle="label">werkzeug</Text>
          <Text fontSize="13px">{card.werkzeug.join(" · ") || "—"}</Text>
        </Box>
        <Box flex="1" minW="240px">
          <Text textStyle="label">sicherheit</Text>
          <Text fontSize="13px" lineHeight="1.45">
            {card.sicherheit}
          </Text>
        </Box>
      </Flex>

      <Box>
        {card.schritte.map((step, i) => (
          <Flex
            key={step.text}
            gap="3"
            py="2"
            borderBottomWidth="1px"
            borderColor="border"
          >
            <Text
              textStyle="data"
              fontSize="12px"
              color="fg.muted"
              w="16px"
              flexShrink={0}
            >
              {i + 1}
            </Text>
            <Box>
              <Text fontSize="13px" lineHeight="1.45">
                {step.text}
              </Text>
              {step.sensorik ? (
                <Text fontSize="12px" color="fg.muted" mt="0.5">
                  {step.sensorik}
                </Text>
              ) : null}
            </Box>
          </Flex>
        ))}
      </Box>

      {card.fehler.length ? (
        <Box
          px="3.5"
          py="3"
          borderLeftWidth="3px"
          borderColor="accent"
          bg="accent.tint"
          borderRightRadius="9px"
        >
          <Text textStyle="label" color="accent.solid" mb="1">
            typische fehler
          </Text>
          {card.fehler.map((f) => (
            <Text key={f} fontSize="12.5px" lineHeight="1.4">
              · {f}
            </Text>
          ))}
        </Box>
      ) : null}

      <Flex justify="space-between" gap="3" wrap="wrap" align="center">
        <Text textStyle="meta">übung · {card.uebung}</Text>
        {card.passtZu.length ? (
          <Text textStyle="meta">passt zu: {card.passtZu.join(" · ")}</Text>
        ) : null}
      </Flex>

      <Flex gap="2">
        <Chip
          label={`Ideen mit ${card.query.split(" ")[0]}`}
          onClick={onIdeas}
        />
        <Chip label="Chef fragen" onClick={onAsk} />
      </Flex>
    </Stack>
  );
}
