// Canonical list of agent ids for the migrate agentic flow. Zero-dep so the
// yargs layer can import it for `--agentic` validation without dragging in
// the rest of the agentic chain.
export const AGENT_IDS = ['claude-code', 'codex', 'opencode'] as const;

export type AgentId = (typeof AGENT_IDS)[number];
