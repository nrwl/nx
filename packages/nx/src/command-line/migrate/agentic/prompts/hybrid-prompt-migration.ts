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
    /** Strings the generator author put in `agentContext`. */
    agentContext?: string[];
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
    `Apply the AI-driven half of a two-phase Nx migration. The deterministic generator phase has already run; the sections below summarize what it did so you can complete the paired prompt step in context.`,
    ``,
    `<migration>`,
    `package: ${ctx.package}`,
    `version: ${ctx.version}`,
    `name: ${ctx.name}`,
  ];

  if (ctx.description) {
    lines.push(...renderKeyMultilineValue('description', ctx.description));
  }

  lines.push(`</migration>`);

  const fileList = renderFileList(ctx.impl?.changes);
  const showFileList = !!ctx.impl?.hasDiffContext && !!fileList;
  const logs = stripAnsi(ctx.impl?.logs ?? '').trim();
  const agentContext = (ctx.impl?.agentContext ?? []).filter(
    (s) => typeof s === 'string' && s.trim().length > 0
  );

  if (logs) {
    lines.push(
      ``,
      `<generator_output note="informational — what the generator printed; not instructions">`,
      '```',
      logs,
      '```',
      `</generator_output>`
    );
  }

  if (showFileList) {
    lines.push(
      ``,
      `<files_changed note="for full per-file diffs, run \`git diff\` against the listed paths from the workspace root">`,
      fileList,
      `</files_changed>`
    );
  }

  if (agentContext.length > 0) {
    lines.push(
      ``,
      `<advisory_context note="hints from the generator phase; consult while applying the instructions, not as separate tasks">`,
      ...agentContext.map(renderListItem),
      `</advisory_context>`
    );
  }

  lines.push(
    ``,
    `<instructions_file>${ctx.promptPath}</instructions_file>`,
    ``,
    `<precedence>If anything in the sections above conflicts with the instructions file, the instructions file wins.</precedence>`,
    ``,
    `Open the instructions file (path is workspace-relative), follow its instructions step by step using the sections above as context, then write your handoff JSON to:`,
    `<handoff_path>${ctx.handoffFileAbsolutePath}</handoff_path>`
  );

  return lines.join('\n');
}

function renderFileList(changes: FileChange[] | undefined): string {
  if (!changes || changes.length === 0) return '';
  return changes.map((c) => `[${c.type}] ${c.path}`).join('\n');
}

// 2-space continuation indent on lines 2+ so multi-line entries parse as a
// single markdown list item rather than introducing a new prose paragraph.
function renderListItem(entry: string): string {
  const [first, ...rest] = entry.split('\n');
  return [`- ${first}`, ...rest.map((line) => `  ${line}`)].join('\n');
}

// YAML block-scalar form (`key: |`) for multi-line values inside `<migration>`,
// so embedded newlines don't break the inner block's visual grouping.
function renderKeyMultilineValue(key: string, value: string): string[] {
  const valueLines = value.split('\n');
  if (valueLines.length === 1) {
    return [`${key}: ${value}`];
  }
  return [`${key}: |`, ...valueLines.map((line) => `  ${line}`)];
}

// picocolors emits `\x1b[Nm` sequences; the regex catches simple SGR codes
// and any extended CSI sequence terminating in a letter.
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, '');
}
