import { Stack, Text, chakra } from "@chakra-ui/react";

function SettingsAction({
  children,
  onClick,
}: {
  children: string;
  onClick?: () => void;
}) {
  if (!onClick) {
    return (
      <Text fontSize="sm" color="fg.faint">
        Open the widget’s ⚙ settings to continue.
      </Text>
    );
  }
  return (
    <chakra.button
      type="button"
      onClick={onClick}
      fontSize="sm"
      fontWeight="medium"
      color="link"
      cursor="pointer"
      _hover={{ textDecoration: "underline" }}
    >
      {children}
    </chakra.button>
  );
}

/**
 * Shown when a widget's integration has no credentials yet. `onConnect` opens
 * the widget's own settings modal (wired from the host via `onOpenSettings`).
 */
export function ConnectPrompt({
  label,
  onConnect,
}: {
  label: string;
  onConnect?: () => void;
}) {
  return (
    <Stack gap="2" align="start">
      <Text fontSize="sm" color="fg.muted">
        {label} isn’t connected yet.
      </Text>
      <SettingsAction
        onClick={onConnect}
      >{`Connect ${label} →`}</SettingsAction>
    </Stack>
  );
}

/**
 * Shown when the provider rejected a stored credential (expired, revoked, or
 * missing a scope). `detail` is the provider's own explanation — surfacing it
 * is the difference between "HTTP 401" and "your token expired".
 */
export function ReconnectPrompt({
  label,
  detail,
  onReconnect,
}: {
  label: string;
  detail?: string;
  onReconnect?: () => void;
}) {
  return (
    <Stack gap="2" align="start">
      <Text fontSize="sm" color="danger">
        {label} rejected the saved token.
      </Text>
      {detail ? (
        <Text fontSize="xs" color="fg.muted">
          {detail}
        </Text>
      ) : null}
      <SettingsAction
        onClick={onReconnect}
      >{`Reconnect ${label} →`}</SettingsAction>
    </Stack>
  );
}
