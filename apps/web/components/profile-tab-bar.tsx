"use client";

import NextLink from "next/link";
import type { FlexProps } from "@chakra-ui/react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { accentHex, monogram } from "@/lib/accent";

interface TabBarProfile {
  id: string;
  name: string;
  accent: string | null;
  monogram: string | null;
}

interface ProfileTabBarProps extends FlexProps {
  profiles: TabBarProfile[];
  activeId?: string;
}

/**
 * Mobile desk switcher: the monogram rail turned on its side, pinned to the
 * bottom within thumb reach. Mirrors ProfileRail's visual language. It's a flex
 * sibling of the scrolling pane (not `position: fixed`), so it never overlaps
 * content; it only pads itself for the home-indicator safe area.
 */
export function ProfileTabBar({
  profiles,
  activeId,
  ...rest
}: ProfileTabBarProps) {
  return (
    <Flex
      as="nav"
      align="center"
      justify="safe center"
      gap="2"
      flexShrink={0}
      px="3"
      pt="2"
      pb="calc(env(safe-area-inset-bottom) + 8px)"
      bg="bg.rail"
      borderTopWidth="1px"
      borderColor="border"
      backdropFilter="blur(10px)"
      overflowX="auto"
      {...rest}
    >
      <NextLink href="/" style={{ textDecoration: "none" }} title="All desks">
        <Flex
          layerStyle="raised"
          boxSize="44px"
          borderRadius="full"
          align="center"
          justify="center"
          color="fg"
          flexShrink={0}
        >
          <Text fontFamily="mono" fontSize="lg" lineHeight="1">
            ▍
          </Text>
        </Flex>
      </NextLink>

      {profiles.map((profile) => {
        const active = profile.id === activeId;
        return (
          <NextLink
            key={profile.id}
            href={`/${profile.id}`}
            style={{ textDecoration: "none" }}
            title={profile.name}
          >
            <Flex
              position="relative"
              w="44px"
              h="44px"
              flexShrink={0}
              align="center"
              justify="center"
              borderRadius="small"
              fontFamily="mono"
              fontSize="sm"
              fontWeight="medium"
              transition="all 0.15s ease"
              layerStyle={active ? "raised" : undefined}
              color={active ? "fg" : "fg.muted"}
            >
              {monogram(profile.name, profile.monogram)}
              <Box
                position="absolute"
                bottom="1"
                boxSize="4px"
                borderRadius="full"
                bg={accentHex(profile.accent)}
                opacity={active ? 1 : 0.55}
              />
            </Flex>
          </NextLink>
        );
      })}
    </Flex>
  );
}
