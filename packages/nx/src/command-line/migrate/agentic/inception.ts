import { isAiAgent } from '../../../native';

/**
 * Returns true when `nx migrate` is itself being run from inside another AI
 * agent's terminal session. Used to short-circuit the agentic flow so we never
 * spawn an inner agent inside an outer agent.
 *
 * The native `isAiAgent()` covers Claude Code, Cursor, OpenCode, Gemini, and
 * Replit. Codex (`CODEX_THREAD_ID`) is not yet handled on the native side; the
 * env-var check here closes that gap for the migrate flow specifically. The
 * generic native addition is tracked as a follow-up.
 */
export function isInsideAgent(): boolean {
  if (isAiAgent()) {
    return true;
  }
  return !!process.env.CODEX_THREAD_ID;
}
