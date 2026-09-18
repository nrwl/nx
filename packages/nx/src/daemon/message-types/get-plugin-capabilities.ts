export const GET_PLUGIN_CAPABILITIES = 'GET_PLUGIN_CAPABILITIES' as const;

export type HandleGetPluginCapabilitiesMessage = {
  type: typeof GET_PLUGIN_CAPABILITIES;
};

export function isHandleGetPluginCapabilitiesMessage(
  message: unknown
): message is HandleGetPluginCapabilitiesMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_PLUGIN_CAPABILITIES
  );
}
