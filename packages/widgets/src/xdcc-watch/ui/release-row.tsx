"use client";

import { useState } from "react";
import { Box, Flex, Image, Stack, Text, chakra } from "@chakra-ui/react";
import type { ReleaseDto } from "../types";
import { copyCommand, formatAge, formatSize } from "./lib";

interface ReleaseRowProps {
  release: ReleaseDto;
  showCommands: boolean;
  isNew?: boolean;
}

/** One release: poster, the parsed headline in prose, the offers in mono. */
export function ReleaseRow({ release, showCommands, isNew }: ReleaseRowProps) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(index: number) {
    const offer = release.offers[index];
    if (!offer) return;
    setCopied((await copyCommand(offer)) ? `${index}` : null);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Flex
      gap="3"
      py="3"
      borderBottomWidth="1px"
      borderColor="border"
      align="flex-start"
    >
      {release.poster ? (
        <Image
          src={release.poster}
          alt=""
          w="34px"
          h="50px"
          borderRadius="4px"
          objectFit="cover"
          boxShadow="raisedSm"
          flexShrink={0}
        />
      ) : null}
      <Box flex="1" minW="0">
        <Flex align="center" gap="2" wrap="wrap">
          <Text fontSize="sm" fontWeight="semibold" lineHeight="1.3">
            {release.headline}
          </Text>
          {isNew ? (
            <Box
              px="2"
              borderRadius="pill"
              bg="accent.tint"
              color="accent.solid"
              textStyle="data"
              fontSize="10px"
            >
              new {formatAge(release.firstSeenAt)}
            </Box>
          ) : null}
        </Flex>
        <Text textStyle="meta" wordBreak="break-all" mb="1">
          {release.offers[0]?.filename}
        </Text>
        <Stack gap="0.5">
          {release.offers.map((offer, i) => (
            <Flex
              key={`${offer.source}-${offer.bot}-${offer.pack}`}
              gap="2"
              align="center"
              wrap="wrap"
            >
              <Text textStyle="meta" color="fg.muted">
                {offer.network}
                {offer.channel ? ` · ${offer.channel}` : ""} · {offer.bot} · #
                {offer.pack} · {formatSize(offer.sizeBytes)}
                {offer.gets !== null ? ` · ${offer.gets}×` : ""}
              </Text>
              {showCommands ? (
                <chakra.button
                  type="button"
                  onClick={() => void copy(i)}
                  textStyle="meta"
                  color="link"
                  cursor="pointer"
                  _hover={{ color: "link.hover" }}
                  aria-label={`Copy the command for ${offer.bot} pack ${offer.pack}`}
                >
                  {copied === `${i}` ? "copied" : "copy"}
                </chakra.button>
              ) : null}
            </Flex>
          ))}
        </Stack>
      </Box>
    </Flex>
  );
}
