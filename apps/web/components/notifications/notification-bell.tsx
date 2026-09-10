"use client";

import { useState } from "react";
import { Box, Portal, chakra } from "@chakra-ui/react";
import { NotificationInbox } from "./notification-inbox";
import { NotificationSettings } from "./notification-settings";
import { useNotifications } from "./use-notifications";

interface NotificationBellProps {
  /** Button diameter in px — 40 in the rail, 44 in the tab bar. */
  size?: number;
}

/** The raised bell with an unread pill; opens the inbox modal. */
export function NotificationBell({ size = 40 }: NotificationBellProps) {
  const [view, setView] = useState<"inbox" | "settings" | null>(null);
  const { unread } = useNotifications();
  const label =
    unread > 0
      ? `Notifications, ${unread} unread`
      : "Notifications, nothing unread";

  return (
    <>
      <chakra.button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setView("inbox")}
        layerStyle="raised"
        boxSize={`${size}px`}
        borderRadius="full"
        color="fg"
        cursor="pointer"
        position="relative"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        _active={{ boxShadow: "inset" }}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 7H4c0-1 2-2 2-7" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 ? (
          <Box
            position="absolute"
            top="-4px"
            right="-6px"
            minW="18px"
            h="18px"
            px="5px"
            borderRadius="full"
            bg="accent.solid"
            color="accent.fg"
            textStyle="data"
            fontSize="10px"
            lineHeight="18px"
            textAlign="center"
            boxShadow="raisedSm"
          >
            {unread > 99 ? "99+" : unread}
          </Box>
        ) : null}
      </chakra.button>
      {/* Portalled: the rail and tab bar use backdrop-filter, which would turn
          the modal's fixed positioning into a 72px-wide box. */}
      <Portal>
        <NotificationInbox
          open={view === "inbox"}
          onClose={() => setView(null)}
          onOpenSettings={() => setView("settings")}
        />
        <NotificationSettings
          open={view === "settings"}
          onClose={() => setView(null)}
        />
      </Portal>
    </>
  );
}
