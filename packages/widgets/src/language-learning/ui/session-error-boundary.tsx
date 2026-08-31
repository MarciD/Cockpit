"use client";

import { Component, type ReactNode } from "react";
import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";

interface SessionErrorBoundaryProps {
  children: ReactNode;
  /** Re-mount the subtree, keeping any persisted session (rehydrates it). */
  onResume: () => void;
  /** Clear the persisted session, then re-mount to a clean slate. */
  onStartOver: () => void;
}

interface SessionErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render crashes in the learning panels so one bad LLM payload can't
 * blank the whole widget. Pairs with usePersistentState: "Resume" re-mounts and
 * rehydrates the saved session; "Start over" clears it first. The parent owns
 * the actual re-mount (via a changing key), so this only reports the intent.
 */
export class SessionErrorBoundary extends Component<
  SessionErrorBoundaryProps,
  SessionErrorBoundaryState
> {
  state: SessionErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SessionErrorBoundaryState {
    return { error };
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <Box layerStyle="tile" p="5">
        <Stack gap="3">
          <Text fontSize="md" color="fg">
            This session hit a snag.
          </Text>
          <Text fontSize="sm" color="fg.muted">
            Your progress and vocabulary are saved. You can pick up where you
            left off, or start fresh.
          </Text>
          <HStack gap="2">
            <Button
              size="sm"
              bg="accent"
              color="accent.fg"
              _hover={{ bg: "accent.solid" }}
              onClick={this.props.onResume}
            >
              Resume
            </Button>
            <Button
              size="sm"
              layerStyle="raised"
              color="fg"
              onClick={this.props.onStartOver}
            >
              Start over
            </Button>
          </HStack>
        </Stack>
      </Box>
    );
  }
}
