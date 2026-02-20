export const GET_CONFIGURE_AI_AGENTS_STATUS =
  'GET_CONFIGURE_AI_AGENTS_STATUS' as const;

export type HandleGetConfigureAiAgentsStatusMessage = {
  type: typeof GET_CONFIGURE_AI_AGENTS_STATUS;
};

export type AgentStatusInfo = {
  name: string;
  displayName: string;
};

export type ConfigureAiAgentsStatusResponse = {
  fullyConfiguredAgents: AgentStatusInfo[];
  outdatedAgents: AgentStatusInfo[];
  partiallyConfiguredAgents: AgentStatusInfo[];
  nonConfiguredAgents: AgentStatusInfo[];
};

export function isHandleGetConfigureAiAgentsStatusMessage(
  message: unknown
): message is HandleGetConfigureAiAgentsStatusMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === GET_CONFIGURE_AI_AGENTS_STATUS
  );
}

export const RESET_CONFIGURE_AI_AGENTS_STATUS =
  'RESET_CONFIGURE_AI_AGENTS_STATUS' as const;

export type HandleResetConfigureAiAgentsStatusMessage = {
  type: typeof RESET_CONFIGURE_AI_AGENTS_STATUS;
};

export function isHandleResetConfigureAiAgentsStatusMessage(
  message: unknown
): message is HandleResetConfigureAiAgentsStatusMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === RESET_CONFIGURE_AI_AGENTS_STATUS
  );
}
