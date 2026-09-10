"use client";

import { Box, Flex } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { NotificationToaster } from "./notifications/notification-toaster";
import { NotificationWatch } from "./notifications/notification-watch";
import { ProfileRail } from "./profile-rail";
import { ProfileTabBar } from "./profile-tab-bar";

interface AppShellProfile {
  id: string;
  name: string;
  accent: string | null;
  monogram: string | null;
}

/**
 * Full-screen cockpit. Desktop (≥768px): fixed left rail + scrolling main pane.
 * Mobile: the rail becomes a bottom tab bar within thumb reach, and the pane
 * clears the notch via the top safe-area inset. `children` is rendered once — a
 * second tree per breakpoint would double-mount every widget and cold-start its
 * TanStack queries on every rotation.
 */
export function AppShell({
  profiles,
  activeId,
  children,
}: {
  profiles: AppShellProfile[];
  activeId?: string;
  children: ReactNode;
}) {
  return (
    <Flex
      direction={{ base: "column", md: "row" }}
      h="100dvh"
      overflow="hidden"
    >
      <ProfileRail
        profiles={profiles}
        activeId={activeId}
        display={{ base: "none", md: "flex" }}
      />
      <Box
        flex="1"
        minH="0"
        overflowY="auto"
        pt={{ base: "env(safe-area-inset-top)", md: 0 }}
      >
        {children}
      </Box>
      <ProfileTabBar
        profiles={profiles}
        activeId={activeId}
        display={{ base: "flex", md: "none" }}
      />
      <NotificationWatch />
      <NotificationToaster />
    </Flex>
  );
}
