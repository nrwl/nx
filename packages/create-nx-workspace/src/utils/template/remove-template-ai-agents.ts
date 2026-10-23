import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const AGENT_DIRECTORIES = [
  '.agents',
  '.claude',
  '.codex',
  '.cursor',
  '.gemini',
  '.opencode',
];

// Copilot files sit beside CI workflows under `.github`. Drop the agent
// directories and leave `workflows/` in place.
const GITHUB_AGENT_DIRECTORIES = [
  '.github/agents',
  '.github/prompts',
  '.github/skills',
  '.github/instructions',
];

const AGENT_FILES = ['CLAUDE.md', 'GEMINI.md', 'opencode.json'];

const GITIGNORE_ENTRIES = new Set([
  '.cursor/rules/nx-rules.mdc',
  '.github/instructions/nx.instructions.md',
  '.claude/worktrees',
  '.claude/settings.local.json',
]);

const NX_RULES_START = '<!-- nx configuration start-->';
const NX_RULES_END = '<!-- nx configuration end-->';

// Normalized options.aiAgents is empty for both `--aiAgents=none` and an
// omitted flag. Only an explicit `none` removes files the template ships.
export function shouldRemoveTemplateAiAgents(
  options: { aiAgents?: readonly string[] },
  rawArgs?: { aiAgents?: readonly string[] }
): boolean {
  if (rawArgs) {
    const requested = rawArgs.aiAgents;
    return (
      !!requested &&
      requested.length > 0 &&
      requested.every((agent) => agent === 'none')
    );
  }
  return !!options.aiAgents && options.aiAgents.length === 0;
}

export function removeTemplateAiAgents(directory: string): void {
  for (const relativePath of [
    ...AGENT_DIRECTORIES,
    ...GITHUB_AGENT_DIRECTORIES,
  ]) {
    rmSync(join(directory, relativePath), { recursive: true, force: true });
  }
  removeIfEmpty(join(directory, '.github'));

  for (const relativePath of AGENT_FILES) {
    rmSync(join(directory, relativePath), { force: true });
  }

  stripNxConfiguration(join(directory, 'AGENTS.md'));
  stripGitignoreEntries(join(directory, '.gitignore'));
}

function removeIfEmpty(directory: string): void {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return;
  if (readdirSync(directory).length === 0) {
    rmSync(directory, { recursive: true, force: true });
  }
}

function stripNxConfiguration(path: string): void {
  if (!existsSync(path)) return;
  const original = readFileSync(path, 'utf-8');
  if (!original.includes(NX_RULES_START)) return;
  const nxRulesRegex = new RegExp(
    `${NX_RULES_START}[\\s\\S]*?${NX_RULES_END}`,
    'g'
  );
  const updated = original
    .replace(nxRulesRegex, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!updated) {
    rmSync(path, { force: true });
    return;
  }
  writeFileSync(path, updated + '\n');
}

function stripGitignoreEntries(path: string): void {
  if (!existsSync(path)) return;
  const original = readFileSync(path, 'utf-8');
  const endsWithNewline = original.endsWith('\n');
  const filtered = original
    .split('\n')
    .filter((line) => !GITIGNORE_ENTRIES.has(line.trim()));
  let next = filtered.join('\n').replace(/\n{3,}/g, '\n\n');
  if (endsWithNewline && !next.endsWith('\n')) {
    next += '\n';
  }
  if (next !== original) {
    writeFileSync(path, next);
  }
}
