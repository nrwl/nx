// Wording the agent system prompt (system-prompt.ts) and the orchestrated
// run's runbook (run/runbook.ts) must state identically.

export function renderNxInvocationNote(
  packageManager: string,
  nxInvocation: string
): string {
  return `Use \`${packageManager}\` for any package-manager invocation in this workspace. To invoke nx, use \`${nxInvocation} ...\`. Do not default to a different package manager based on your own preference.`;
}

export function renderHandoffShapeLines(): string[] {
  return [
    `{`,
    `  "status": "success" | "failed",`,
    `  "summary": "[one to three sentences: what was done, or why it failed]"`,
    `}`,
  ];
}

// Scope rules for applying an author-provided migration prompt (prompt-only or
// hybrid migration).
export function renderAuthorScopeRuleLines(): string[] {
  return [
    `- Apply only the changes the migration prompt asks for.`,
    `- Do not refactor or update dependencies beyond what the migration prompt directs, and do not reformat files you did not change.`,
    `- After applying your changes and before writing the handoff, format the files you created or modified so they match the workspace's style. If the workspace uses Prettier, run it over exactly those files through the workspace package manager (e.g. \`npx prettier --write --ignore-unknown <paths>\` in an npm workspace; \`--ignore-unknown\` keeps paths Prettier has no parser for from failing the command); if it has no formatter configured, skip this. Do not use \`nx format:write\` for this: it also selects files changed earlier on the branch and always reformats the root config files.`,
    `- Do not modify files outside the workspace root.`,
    `- Do not run \`nx\` commands that mutate workspace state (\`nx migrate\`, \`nx reset\`, \`nx format:write\`, \`nx run-many\`, generators, etc.). Read-only inspection (\`nx show\`, \`nx graph --file\`, reading files) is fine.`,
    `- If the migration instructions are unclear, internally inconsistent, or conflict with the current workspace state, ask the user for direction (see the handoff contract). Do not guess.`,
  ];
}

export function renderValidationScopeRuleLines(): string[] {
  return [
    `- Your job is to validate the generator's changes. Inspect the listed changes, run the smallest relevant set of verification tasks, and report findings.`,
    `- Discover what targets exist before running tasks: \`nx show project <name> --json\` is authoritative, since it includes targets inferred by plugins. Reading a project's \`project.json\` / \`package.json\` misses inferred targets; treat it as an incomplete fallback for when the project graph cannot be built. Do not assume specific target names (\`typecheck\`, \`test\`, \`lint\`) are available, since workspaces vary. Run what the project actually has; if no typecheck-equivalent exists, \`build\` is an acceptable substitute.`,
    `- You may run nx tasks for verification, scoped to this migration's changes: \`nx affected --files=<comma-separated changed paths> -t <target>\`, \`nx run <project>:<target>\`, or \`nx run-many -t <target> -p <project1>,<project2>\` where the project list is derived from the changed files. Bare \`nx affected\` (no \`--files\`) selects the branch delta plus everything uncommitted, and unscoped \`nx run-many\` (no \`-p\`) is forbidden.`,
    `- Read-only and artifact-writing inspection commands are permitted: \`nx show project\`, \`nx graph --file <path>\`, reading files. These do not mutate workspace source.`,
    `- You may apply minor fixes only when the issue lies within the scope of what this migration intended to accomplish (e.g. a missing import the generator's template should have produced, a type annotation the template missed). Do not refactor, do not modify unrelated functionality, do not extend the migration's scope, do not touch code the migration was not concerned with. If you are unsure whether a fix is in scope, report it in \`summary\` instead of applying.`,
    `- Do not run other \`nx\` commands that mutate workspace state (\`nx migrate\`, \`nx reset\`, generators, etc.).`,
    `- Do not modify files outside the workspace root.`,
    `- If validation finds blocking issues you cannot resolve within scope: apply every fix you can within scope, then report the unresolved findings to the user and ask how to proceed (see the handoff contract). Do not guess.`,
  ];
}
