import { detectAiAgent, getMainWorktreeRoot } from '../native';
import { isSandbox } from './is-sandbox';

/**
 * Carries the client's worktree-data decision into the daemon and plugin
 * workers, where AI-agent detection variables are intentionally stripped.
 */
export const NX_INTERNAL_USE_LOCAL_WORKTREE_DATA =
  'NX_INTERNAL_USE_LOCAL_WORKTREE_DATA';

/**
 * Non-Claude agent sandboxes cannot safely write through to the main
 * worktree's machine-specific .nx directory. Claude is the exception because
 * configure-ai-agents adds that directory to its local sandbox allowlist.
 */
export function shouldUseLocalWorktreeData(): boolean {
  const propagatedDecision = process.env[NX_INTERNAL_USE_LOCAL_WORKTREE_DATA];
  if (propagatedDecision === 'true') {
    return true;
  }
  if (propagatedDecision === 'false') {
    return false;
  }
  if (!isSandbox()) {
    return false;
  }

  return detectAiAgent() !== 'claude';
}

/**
 * Returns the root whose .nx data should be used for this process.
 *
 * Worktrees normally share the main checkout's cache and workspace data. A
 * sandboxed non-Claude agent falls back to its own worktree so cache writes do
 * not cross the sandbox boundary.
 */
export function getWorktreeDataRoot(root: string): string {
  if (shouldUseLocalWorktreeData()) {
    return root;
  }

  try {
    return getMainWorktreeRoot(root) ?? root;
  } catch {
    // Worktree detection is best-effort.
    return root;
  }
}
