/**
 * Canonical list of agent ids supported by the migrate agentic flow in v1.
 *
 * Lives in its own zero-dep file so it can be imported by the yargs layer for
 * `--agentic` validation without pulling in the rest of the agentic chain.
 * The `AgentId` type in `./types.ts` is derived from this list.
 */
export const AGENT_IDS = ['claude-code', 'codex', 'opencode'] as const;

export type AgentId = (typeof AGENT_IDS)[number];
