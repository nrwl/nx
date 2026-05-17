import type { FileChange } from '../../../../generators/tree';

export interface HybridPromptMigrationContext {
  package: string;
  name: string;
  version: string;
  description?: string;
  /** Workspace-relative path to the prompt `.md` file. */
  promptPath: string;
  /** Absolute path the agent must write its handoff file to. */
  handoffFileAbsolutePath: string;
  /** Context captured from the deterministic generator phase. */
  impl?: {
    /** Raw output from the generator (devkit logger + console). */
    logs?: string;
    /** Files the generator changed. Rendered as a `[TYPE] path` list. */
    changes?: FileChange[];
    /** Strings the generator author put in `promptContext`. */
    promptContext?: string[];
    /**
     * False when per-migration commits are disabled; the file-list section
     * is omitted because the diff boundary is meaningless without them.
     */
    hasDiffContext?: boolean;
  };
}

/**
 * Builds the user prompt for a hybrid migration's prompt phase (`implementation`
 * + `prompt`). The deterministic generator has already run; sections of the
 * prompt summarize what it did so the agent can complete the paired step with
 * awareness of the generator's output.
 *
 * Each impl section is omitted when its source is empty. When the generator
 * made no changes at all, the prompt collapses to the metadata + prompt-file +
 * handoff-file blocks.
 */
export function buildHybridPromptUserPrompt(
  ctx: HybridPromptMigrationContext
): string {
  const lines: string[] = [
    `Apply the prompt-based half of this paired Nx migration. The deterministic generator phase has already run.`,
    ``,
    `Migration: ${ctx.package}@${ctx.version} — ${ctx.name}`,
  ];

  if (ctx.description) {
    lines.push(`Description: ${ctx.description}`);
  }

  const fileList = renderFileList(ctx.impl?.changes);
  const showFileList = !!ctx.impl?.hasDiffContext && !!fileList;
  const logs = stripAnsi(ctx.impl?.logs ?? '').trim();
  const promptContext = (ctx.impl?.promptContext ?? []).filter(
    (s) => typeof s === 'string' && s.length > 0
  );

  if (logs) {
    lines.push(``, `Generator phase output:`, indent(logs));
  }

  if (showFileList) {
    lines.push(
      ``,
      `Files modified by the generator phase:`,
      fileList,
      `(Run \`git diff <path>\` from the workspace root for full per-file diffs.)`
    );
  }

  if (promptContext.length > 0) {
    lines.push(
      ``,
      `Context from the generator phase (advisory — address only what is relevant to the prompt-migration instructions):`,
      ...promptContext.map((entry) => `  - ${entry}`)
    );
  }

  lines.push(
    ``,
    `The prompt-migration instructions are in this file (relative to the workspace root):`,
    `  ${ctx.promptPath}`,
    ``,
    `Read that file, apply its instructions in light of the context above, then write your handoff JSON to:`,
    `  ${ctx.handoffFileAbsolutePath}`
  );

  return lines.join('\n');
}

function renderFileList(changes: FileChange[] | undefined): string {
  if (!changes || changes.length === 0) return '';
  return changes.map((c) => `  [${c.type}] ${c.path}`).join('\n');
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

// picocolors emits `\x1b[Nm` sequences; the regex catches simple SGR codes
// and any extended CSI sequence terminating in a letter.
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}
