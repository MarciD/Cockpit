"use client";

import type { ReactNode } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";

/** Minimal modal: dimmed backdrop + centered panel. Backdrop click closes. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <Flex
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom="0"
      zIndex={50}
      align="center"
      justify="center"
      p="4"
      bg="rgba(60,45,30,0.3)"
      backdropFilter="blur(3px)"
      onClick={onClose}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        w="100%"
        maxW="460px"
        maxH="82dvh"
        overflowY="auto"
        layerStyle="tile"
        borderRadius="dialog"
        boxShadow="dialog"
        p="6"
      >
        {title ? (
          <Text textStyle="label" letterSpacing="0.18em" mb="4">
            {title}
          </Text>
        ) : null}
        {children}
      </Box>
    </Flex>
  );
}
