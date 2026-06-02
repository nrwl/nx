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
  renderMigrationDocumentationBlock,
  stripAnsi,
} from './shared-rendering';

export interface GenericValidationPromptContext {
  package: string;
  name: string;
  version: string;
  description?: string;
  /** Absolute path the agent must write its handoff file to. */
  handoffFileAbsolutePath: string;
  /**
   * Path to the migration's documentation file, if any - workspace-relative,
   * or absolute when it resolves outside the workspace.
   */
  documentationPath?: string;
  /** Context captured from the deterministic generator phase. */
  impl: {
    /** Raw output from the generator (devkit logger + console). */
    logs?: string;
    /**
     * Files the generator changed. Rendered inside `<files_changed>` as a
     * `[TYPE] path` list — only when `hasDiffContext` is false; when true the
     * agent is instead instructed to inspect via git.
     */
    changes: FileChange[];
    /** Strings the generator author put in `agentContext`. */
    agentContext?: string[];
    /**
     * True when per-migration commits are in effect (git repo + commits
     * enabled). The prompt instructs the agent to use `git status`/`git diff`
     * for the file list. When false (no git, or commits disabled), the
     * `<files_changed>` block is embedded with `changes` instead.
     */
    hasDiffContext: boolean;
  };
}

/**
 * Cap on the number of file entries rendered verbatim inside `<files_changed>`
 * when the embedded-list path is used (no per-migration commits / no git).
 * Excess entries collapse into a `… and N more files.` line.
 */
export const GENERIC_VALIDATION_FILE_LIST_CAP = 50;

/**
 * Builds the user prompt for the framework-owned generic-validation agent step
 * that runs after a generator-only migration produces changes (when `--validate`
 * is enabled and `--agentic` resolves to an enabled agent).
 *
 * Differences from `buildHybridPromptUserPrompt`:
 * - No `<instructions_file>` block — the framework owns the instructions, and
 *   they live inline in `<validation_instructions>` below.
 * - No `<precedence>` block — there's no external instructions file to defer
 *   to.
 * - File-list cap: when the diff exceeds `GENERIC_VALIDATION_FILE_LIST_CAP`,
 *   the first N entries render verbatim and the remainder collapses into a
 *   `… and N more files.` count line.
 * - The lead sentence frames the agent as a validator, not an applier.
 */
export function buildGenericValidationUserPrompt(
  ctx: GenericValidationPromptContext
): string {
  const lines: string[] = [
    `You are validating the output of an Nx migration's deterministic generator phase. The generator has already run; inspect what it produced, verify the workspace is in a consistent state for what this migration intended to accomplish, apply any minor in-scope fixes the generator should have produced cleanly, and report findings.`,
    ...renderMigrationBlock(ctx),
  ];

  lines.push(...renderMigrationDocumentationBlock(ctx.documentationPath));

  const logs = escapeXmlBody(stripAnsi(ctx.impl.logs ?? '').trim());
  lines.push(...renderGeneratorOutputBlock(logs));

  if (!ctx.impl.hasDiffContext && ctx.impl.changes.length > 0) {
    lines.push(
      ``,
      `<files_changed>`,
      ...renderFileListBody(ctx.impl.changes),
      `</files_changed>`
    );
  }

  const agentContext = filterNonEmptyStrings(ctx.impl.agentContext ?? []);
  if (agentContext.length > 0) {
    lines.push(
      ...renderAdvisoryContext(
        'hints emitted by the generator; treat as supplementary context, not separate tasks',
        agentContext
      )
    );
  }

  const firstStep = ctx.impl.hasDiffContext
    ? `1. Inspect this migration's changes. ${renderGitInspectInstruction()} Resolve each affected path to its owning Nx project via \`nx show project <name>\` (or by reading the project's \`project.json\` / \`package.json\`) to discover which targets each project actually defines — do not assume \`typecheck\` / \`test\` / \`lint\` exist. If no typecheck-equivalent exists, \`build\` is an acceptable substitute.`
    : `1. Resolve each path in <files_changed> to its owning Nx project. Use \`nx show project <name>\` (or read the project's \`project.json\` / \`package.json\`) to discover which targets each project actually defines — do not assume \`typecheck\` / \`test\` / \`lint\` exist. If no typecheck-equivalent exists, \`build\` is an acceptable substitute.`;

  lines.push(
    ``,
    `<validation_instructions>`,
    firstStep,
    `2. Pick the smallest relevant subset of available targets to verify the change. Prefer \`nx affected -t <target>\` (or \`nx run <project>:<target>\` for a single project). When many small projects are affected, you may use \`nx run-many -t <target> -p <project1>,<project2>\` with the project list derived from the changed files. Unscoped \`nx run-many\` (no \`-p\`) is forbidden.`,
    `3. If a verification surfaces an issue the migration should have produced cleanly (e.g. a missing import, a type annotation the generator's template missed), you may apply a minor in-scope fix. The boundary is "what this migration intended to accomplish" — do not refactor, do not modify functionality unrelated to the migration, do not extend the migration's scope, do not touch code the migration was not concerned with. If you are unsure whether a fix is in scope, report it in \`summary\` instead of applying.`,
    `4. Apply every fix you can within scope, then write your handoff. On \`status: "success"\`, summarize what you verified and any fixes you applied. On \`status: "failed"\`, enumerate the unresolved findings in \`summary\` so the user can address them; no commit will be created from a failed run, so the generator's changes and your partial fixes will sit uncommitted in the working tree for the user to review.`,
    `</validation_instructions>`,
    ``,
    `Once you finish, write your handoff JSON to:`,
    ...renderHandoffPathFooter(ctx.handoffFileAbsolutePath)
  );

  return lines.join('\n');
}

function renderFileListBody(changes: FileChange[]): string[] {
  // File paths from `tree.write` are user-authored; escape `<` / `&` so a
  // hostile path can't break out of `<files_changed>`. `change.type` is an
  // nx-controlled enum (CREATE/UPDATE/DELETE) and needs no escape.
  const safe = changes.map((change) => ({
    ...change,
    path: escapeXmlBody(change.path),
  }));
  if (safe.length <= GENERIC_VALIDATION_FILE_LIST_CAP) {
    return safe.map(renderFileEntry);
  }
  const shown = safe.slice(0, GENERIC_VALIDATION_FILE_LIST_CAP);
  const remaining = safe.length - GENERIC_VALIDATION_FILE_LIST_CAP;
  return [
    ...shown.map(renderFileEntry),
    ``,
    `… and ${remaining} more file${remaining === 1 ? '' : 's'}.`,
  ];
}
