"use client";

import NextLink from "next/link";
import type { FlexProps } from "@chakra-ui/react";
import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { accentHex, monogram } from "@/lib/accent";
import { NotificationBell } from "./notifications/notification-bell";

interface RailProfile {
  id: string;
  name: string;
  accent: string | null;
  monogram: string | null;
}

interface ProfileRailProps extends FlexProps {
  profiles: RailProfile[];
  activeId?: string;
}

/** Full-height monogram rail — the "rack of channels"; active desk pops. */
export function ProfileRail({ profiles, activeId, ...rest }: ProfileRailProps) {
  return (
    <Flex
      direction="column"
      align="center"
      flexShrink={0}
      w="72px"
      h="100%"
      py="4"
      gap="3"
      bg="bg.rail"
      borderRightWidth="1px"
      borderColor="border"
      backdropFilter="blur(10px)"
      {...rest}
    >
      <NextLink href="/" style={{ textDecoration: "none" }} title="All desks">
        <Flex
          layerStyle="raised"
          boxSize="40px"
          borderRadius="full"
          align="center"
          justify="center"
          color="fg"
        >
          <Text fontFamily="mono" fontSize="lg" lineHeight="1">
            ▍
          </Text>
        </Flex>
      </NextLink>

      <Stack gap="2" align="center" mt="2">
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
                align="center"
                justify="center"
                borderRadius="small"
                fontFamily="mono"
                fontSize="sm"
                fontWeight="medium"
                transition="all 0.15s ease"
                layerStyle={active ? "raised" : undefined}
                color={active ? "fg" : "fg.muted"}
                _hover={active ? undefined : { bg: "bg.subtle", color: "fg" }}
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
      </Stack>

      <Box flex="1" />
      <NotificationBell size={40} />
    </Flex>
  );
}
