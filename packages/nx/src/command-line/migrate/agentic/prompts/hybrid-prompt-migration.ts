import type { FileChange } from '../../../../generators/tree';
import {
  escapeXmlBody,
  filterNonEmptyStrings,
  renderAdvisoryContext,
  renderFileEntry,
  renderGeneratorOutputBlock,
  renderGitInspectInstruction,
  renderHandoffPathFooter,
  renderMigrationBlock,
  stripAnsi,
} from './shared-rendering';

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
    /**
     * Files the generator changed. Rendered inside `<files_changed>` as a
     * `[TYPE] path` list — only when `hasDiffContext` is false; when true the
     * agent is instead pointed at `git status` / `git diff`.
     */
    changes?: FileChange[];
    /** Strings the generator author put in `agentContext`. */
    agentContext?: string[];
    /**
     * True when per-migration commits are in effect (git repo + commits
     * enabled). The prompt then points the agent at git for the file list;
     * when false (no git or commits disabled), `changes` is embedded.
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
 * Structure: XML tags carry section boundaries; markdown (fenced blocks,
 * bullet lists) sits inside tags for inline structure. This is the
 * multi-section case where both Anthropic and OpenAI guidance most clearly
 * favors XML for unambiguous parsing. Each impl section is omitted when its
 * source is empty so the prompt stays minimal when the generator made no
 * meaningful contribution.
 */
export function buildHybridPromptUserPrompt(
  ctx: HybridPromptMigrationContext
): string {
  const lines: string[] = [
    `Complete the AI-driven step that follows the generator phase of a two-phase Nx migration. The deterministic generator phase has already run; the sections below summarize what it did. The step may apply additional changes, verify the generator's output, or both — follow the instructions file.`,
    ...renderMigrationBlock(ctx),
  ];

  const logs = escapeXmlBody(stripAnsi(ctx.impl?.logs ?? '').trim());
  const agentContext = filterNonEmptyStrings(ctx.impl?.agentContext ?? []);
  const hasDiffContext = !!ctx.impl?.hasDiffContext;
  const hasChanges = !!ctx.impl?.changes && ctx.impl.changes.length > 0;

  lines.push(...renderGeneratorOutputBlock(logs));

  if (hasDiffContext && hasChanges) {
    // Live view via git. Suppressed when the generator made no changes —
    // pointing the agent at `git status` for an empty diff is noise.
    lines.push(
      ``,
      `<inspect_changes>`,
      renderGitInspectInstruction(),
      `</inspect_changes>`
    );
  } else if (!hasDiffContext) {
    const embeddedFileList = renderFileList(ctx.impl?.changes);
    if (embeddedFileList) {
      lines.push(``, `<files_changed>`, embeddedFileList, `</files_changed>`);
    }
  }

  if (agentContext.length > 0) {
    lines.push(
      ...renderAdvisoryContext(
        'hints from the generator phase; consult while following the instructions, not as separate tasks',
        agentContext
      )
    );
  }

  lines.push(
    ``,
    `<instructions_file>${escapeXmlBody(ctx.promptPath)}</instructions_file>`,
    ``,
    `<precedence>If anything in the sections above conflicts with the instructions file, the instructions file wins.</precedence>`,
    ``,
    `Open the instructions file (path is workspace-relative), follow its instructions step by step using the sections above as context, then write your handoff JSON to:`,
    ...renderHandoffPathFooter(ctx.handoffFileAbsolutePath)
  );

  return lines.join('\n');
}

function renderFileList(changes: FileChange[] | undefined): string {
  if (!changes || changes.length === 0) return '';
  return changes
    .map((change) => ({ ...change, path: escapeXmlBody(change.path) }))
    .map(renderFileEntry)
    .join('\n');
}
