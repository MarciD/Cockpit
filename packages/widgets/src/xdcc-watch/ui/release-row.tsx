"use client";

import { useState } from "react";
import { Box, Flex, Image, Stack, Text, chakra } from "@chakra-ui/react";
import type { OfferDto, ReleaseDto } from "../types";
import { copyCommand, formatAge, formatSize } from "./lib";

interface ReleaseRowProps {
  release: ReleaseDto;
  showCommands: boolean;
  isNew?: boolean;
}

/**
 * One release: poster, the parsed headline in prose, the offers in mono.
 * Offers arrive ranked (preferred network, then gets), so only the best one
 * shows until asked — a release on fifteen bots is one line, not fifteen.
 */
export function ReleaseRow({ release, showCommands, isNew }: ReleaseRowProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const more = release.offers.length - 1;
  const offers = expanded ? release.offers : release.offers.slice(0, 1);

  async function copy(offer: OfferDto) {
    const ok = await copyCommand(offer);
    setCopied(ok ? offerKey(offer) : null);
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
          {offers.map((offer) => (
            <Flex key={offerKey(offer)} gap="2" align="center" wrap="wrap">
              <Text textStyle="meta" color="fg.muted">
                {offer.network}
                {offer.channel ? ` · ${offer.channel}` : ""} · {offer.bot} · #
                {offer.pack} · {formatSize(offer.sizeBytes)}
                {offer.gets !== null ? ` · ${offer.gets}×` : ""}
              </Text>
              {showCommands ? (
                <chakra.button
                  type="button"
                  onClick={() => void copy(offer)}
                  textStyle="meta"
                  color="link"
                  cursor="pointer"
                  _hover={{ color: "link.hover" }}
                  aria-label={`Copy the command for ${offer.bot} pack ${offer.pack}`}
                >
                  {copied === offerKey(offer) ? "copied" : "copy"}
                </chakra.button>
              ) : null}
            </Flex>
          ))}
          {more > 0 ? (
            <chakra.button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              alignSelf="flex-start"
              textStyle="meta"
              color="link"
              cursor="pointer"
              _hover={{ color: "link.hover" }}
              aria-expanded={expanded}
            >
              {expanded
                ? "fewer"
                : `+${more} more ${more === 1 ? "bot" : "bots"}`}
            </chakra.button>
          ) : null}
        </Stack>
      </Box>
    </Flex>
  );
}

function offerKey(offer: OfferDto): string {
  return `${offer.network}-${offer.bot}-${offer.pack}`;
}
