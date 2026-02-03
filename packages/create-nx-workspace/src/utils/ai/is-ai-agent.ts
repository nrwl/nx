/**
 * Detects if the current process is being run by an AI agent.
 *
 * IMPORTANT: This is a duplicate of the Rust implementation in packages/nx/src/native/utils/ai.rs
 * If you update this file, please also update the Rust version to keep them in sync.
 */
export function isAiAgent(): boolean {
  return isClaudeAi() || isReplitAi() || isCursorAi() || isOpenCodeAi();
}

function isClaudeAi(): boolean {
  return !!process.env.CLAUDECODE;
}

function isReplitAi(): boolean {
  return !!process.env.REPL_ID;
}

function isCursorAi(): boolean {
  const pagerMatches = process.env.PAGER === 'head -n 10000 | cat';
  const hasCursorTraceId = !!process.env.CURSOR_TRACE_ID;
  const hasComposerNoInteraction = !!process.env.COMPOSER_NO_INTERACTION;
  return pagerMatches && hasCursorTraceId && hasComposerNoInteraction;
}

function isOpenCodeAi(): boolean {
  return !!process.env.OPENCODE;
}
