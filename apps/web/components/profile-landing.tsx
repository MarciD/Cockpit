"use client";

import { useRouter } from "next/navigation";
import NextLink from "next/link";
import { useState } from "react";
import {
  Box,
  Flex,
  Grid,
  Heading,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { accentHex, monogram } from "@/lib/accent";
import { DeskForm, type Desk } from "./desk-form";
import { Modal } from "./modal";

/** Which desk the form is editing: nothing, a new one, or an existing one. */
type Editing = { mode: "new" } | { mode: "edit"; desk: Desk } | null;

interface ProfileLandingProps {
  profiles: Desk[];
  userName?: string | null;
}

/** Full-screen desk chooser — large grey-in-grey panels on the gradient. */
export function ProfileLanding({ profiles, userName }: ProfileLandingProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);

  const closeAndRefresh = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <Flex
      direction="column"
      minH="100dvh"
      w="100%"
      maxW="1120px"
      mx="auto"
      px={{ base: "6", md: "12" }}
      py={{ base: "8", md: "12" }}
    >
      <Stack gap="1.5" mb={{ base: "6", md: "10" }}>
        <Flex align="baseline" gap="1.5">
          <Text fontFamily="mono" fontSize="2xl" color="accent" lineHeight="1">
            ▍
          </Text>
          <Heading size="2xl" letterSpacing="-0.02em">
            cockpit
          </Heading>
        </Flex>
        <Text color="fg.muted" fontSize="md">
          {userName ? `Good morning, ${userName}.` : "Good morning."}{" "}
          {profiles.length === 0
            ? "No desks yet."
            : `${profiles.length} ${profiles.length === 1 ? "desk" : "desks"}.`}
        </Text>
      </Stack>

      {profiles.length === 0 ? (
        <Flex flex="1" align="center" justify="center">
          <Stack
            gap="4"
            align="center"
            textAlign="center"
            maxW="380px"
            p="8"
            layerStyle="tile"
            borderRadius="16px"
          >
            <Text textStyle="label" letterSpacing="0.18em">
              First run
            </Text>
            <Text color="fg.muted" fontSize="sm">
              A desk is one page of widgets — a job, a side project, personal
              life. Create one to get started.
            </Text>
            <chakra.button
              type="button"
              onClick={() => setEditing({ mode: "new" })}
              layerStyle="raised"
              px="5"
              py="2.5"
              fontSize="sm"
              fontWeight="medium"
              cursor="pointer"
            >
              Create your first desk
            </chakra.button>
          </Stack>
        </Flex>
      ) : (
        <Grid
          flex="1"
          gap="5"
          templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
          autoRows="minmax(150px, 1fr)"
        >
          {profiles.map((profile) => {
            const hue = accentHex(profile.accent);
            return (
              <Box key={profile.id} position="relative" h="100%">
                <NextLink
                  href={`/${profile.id}`}
                  style={{
                    textDecoration: "none",
                    display: "block",
                    height: "100%",
                  }}
                >
                  <Flex
                    direction="column"
                    justify="space-between"
                    h="100%"
                    minH="150px"
                    p="6"
                    layerStyle="tile"
                    borderRadius="16px"
                    transition="box-shadow 0.2s ease, transform 0.2s ease"
                    _hover={{
                      boxShadow: "panelHover",
                      transform: "translateY(-2px)",
                    }}
                  >
                    <Flex justify="space-between" align="start">
                      <Text
                        fontFamily="mono"
                        fontSize="2xl"
                        fontWeight="medium"
                        color="fg"
                        letterSpacing="0.05em"
                      >
                        {monogram(profile.name, profile.monogram)}
                      </Text>
                      <Box boxSize="9px" mt="2" borderRadius="full" bg={hue} />
                    </Flex>
                    <Stack gap="1">
                      <Heading size="lg" letterSpacing="-0.01em">
                        {profile.name}
                      </Heading>
                      <Text textStyle="label" letterSpacing="0.18em">
                        {profile.kind}
                      </Text>
                    </Stack>
                  </Flex>
                </NextLink>
                <chakra.button
                  type="button"
                  aria-label={`Edit ${profile.name}`}
                  onClick={() => setEditing({ mode: "edit", desk: profile })}
                  position="absolute"
                  right="5"
                  bottom="5"
                  fontSize="sm"
                  color="fg.faint"
                  cursor="pointer"
                  _hover={{ color: "fg" }}
                >
                  ⚙
                </chakra.button>
              </Box>
            );
          })}

          <chakra.button
            type="button"
            onClick={() => setEditing({ mode: "new" })}
            h="100%"
            minH="150px"
            p="6"
            layerStyle="inset"
            borderRadius="16px"
            color="fg.muted"
            fontSize="sm"
            cursor="pointer"
            _hover={{ color: "fg" }}
          >
            + New desk
          </chakra.button>
        </Grid>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === "edit" ? "Edit desk" : "New desk"}
      >
        {editing ? (
          <DeskForm
            desk={editing.mode === "edit" ? editing.desk : undefined}
            onDone={closeAndRefresh}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </Flex>
  );
}
