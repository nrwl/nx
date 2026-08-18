import { isAiAgent } from '../../../native';

/**
 * Returns true when `nx migrate` is itself being run from inside another AI
 * agent's terminal session. Used to short-circuit the agentic flow so we never
 * spawn an inner agent inside an outer agent.
 *
 * Native `isAiAgent()` covers all supported agents (Claude Code, Cursor,
 * OpenCode, Codex, Gemini, Replit) via parent-process env-var sniffing.
 */
export function isInsideAgent(): boolean {
  return isAiAgent();
}
