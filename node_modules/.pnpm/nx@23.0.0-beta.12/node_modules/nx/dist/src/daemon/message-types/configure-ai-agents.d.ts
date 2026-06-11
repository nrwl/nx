export declare const GET_CONFIGURE_AI_AGENTS_STATUS: "GET_CONFIGURE_AI_AGENTS_STATUS";
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
export declare function isHandleGetConfigureAiAgentsStatusMessage(message: unknown): message is HandleGetConfigureAiAgentsStatusMessage;
export declare const RESET_CONFIGURE_AI_AGENTS_STATUS: "RESET_CONFIGURE_AI_AGENTS_STATUS";
export type HandleResetConfigureAiAgentsStatusMessage = {
    type: typeof RESET_CONFIGURE_AI_AGENTS_STATUS;
};
export declare function isHandleResetConfigureAiAgentsStatusMessage(message: unknown): message is HandleResetConfigureAiAgentsStatusMessage;
