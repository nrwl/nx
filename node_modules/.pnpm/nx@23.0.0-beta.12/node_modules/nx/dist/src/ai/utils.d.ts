export declare const supportedAgents: readonly ["claude", "codex", "copilot", "cursor", "gemini", "opencode"];
export type Agent = (typeof supportedAgents)[number];
export declare const agentDisplayMap: Record<Agent, string>;
export type AgentConfiguration = {
    name: Agent;
    displayName: string;
    rules: boolean;
    mcp: boolean;
    rulesPath: string;
    mcpPath: string | null;
    outdated: boolean;
    disabled?: boolean;
};
export declare function getAgentConfigurations(agentsToConsider: Agent[], workspaceRoot: string): Promise<{
    nonConfiguredAgents: AgentConfiguration[];
    partiallyConfiguredAgents: AgentConfiguration[];
    fullyConfiguredAgents: AgentConfiguration[];
    disabledAgents: AgentConfiguration[];
}>;
export declare function configureAgents(agents: Agent[], workspaceRoot: string, useLatest?: boolean): Promise<void>;
