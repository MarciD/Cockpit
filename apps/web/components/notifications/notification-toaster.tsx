"use client";

import {
  Box,
  Portal,
  Stack,
  Toast,
  Toaster as ChakraToaster,
  createToaster,
} from "@chakra-ui/react";

/** Bottom-right, one at a time, paused while the page is idle. */
export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
  max: 3,
});

/** Atelier-styled toast surface; mounted once in the app shell. */
export function NotificationToaster() {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root
            width={{ md: "sm" }}
            layerStyle="tile"
            borderRadius="tile"
            boxShadow="dialog"
            color="fg"
            p="4"
            gap="3"
          >
            <Box
              mt="5px"
              boxSize="8px"
              borderRadius="full"
              flexShrink={0}
              bg={toast.type === "error" ? "danger" : "accent"}
              aria-hidden
            />
            <Stack gap="0.5" flex="1" maxW="100%">
              {toast.title ? (
                <Toast.Title fontSize="sm" fontWeight="semibold">
                  {toast.title}
                </Toast.Title>
              ) : null}
              {toast.description ? (
                <Toast.Description fontSize="xs" color="fg.muted">
                  {toast.description}
                </Toast.Description>
              ) : null}
            </Stack>
            {toast.action ? (
              <Toast.ActionTrigger
                textStyle="label"
                color="link"
                _hover={{ color: "link.hover" }}
              >
                {toast.action.label}
              </Toast.ActionTrigger>
            ) : null}
            {toast.closable ? <Toast.CloseTrigger color="fg.muted" /> : null}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  );
}
