import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  removeTemplateAiAgents,
  shouldRemoveTemplateAiAgents,
} from './remove-template-ai-agents';

describe('shouldRemoveTemplateAiAgents', () => {
  it('should remove files when the CLI passed only none', () => {
    expect(
      shouldRemoveTemplateAiAgents({ aiAgents: [] }, { aiAgents: ['none'] })
    ).toBe(true);
  });

  it('should keep files when the flag was omitted', () => {
    expect(shouldRemoveTemplateAiAgents({ aiAgents: [] }, {})).toBe(false);
  });

  it('should keep files when a real agent was requested alongside none', () => {
    expect(
      shouldRemoveTemplateAiAgents(
        { aiAgents: ['claude'] },
        { aiAgents: ['none', 'claude'] }
      )
    ).toBe(false);
  });

  it('should remove files for a direct caller that passes an empty list', () => {
    expect(shouldRemoveTemplateAiAgents({ aiAgents: [] })).toBe(true);
  });

  it('should keep files when a direct caller omits the option', () => {
    expect(shouldRemoveTemplateAiAgents({})).toBe(false);
  });
});

describe('removeTemplateAiAgents', () => {
  let directory: string;

  beforeEach(() => {
    directory = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-ai-')));
    writeFile(join(directory, '.agents/skills/nx-workspace/SKILL.md'), '#');
    writeFile(join(directory, '.claude/settings.json'), '{}');
    writeFile(join(directory, '.codex/config.toml'), '');
    writeFile(join(directory, '.cursor/skills/nx-workspace/SKILL.md'), '#');
    writeFile(join(directory, '.gemini/settings.json'), '{}');
    writeFile(join(directory, '.opencode/commands/monitor-ci.md'), '#');
    writeFile(join(directory, '.github/agents/ci.agent.md'), '#');
    writeFile(join(directory, '.github/prompts/monitor-ci.prompt.md'), '#');
    writeFile(join(directory, '.github/skills/nx-workspace/SKILL.md'), '#');
    writeFile(join(directory, '.github/instructions/nx.instructions.md'), '#');
    writeFile(join(directory, '.github/workflows/ci.yml'), 'name: CI\n');
    writeFile(join(directory, 'opencode.json'), '{}\n');
    writeFile(join(directory, 'CLAUDE.md'), '# claude\n');
    writeFile(join(directory, 'GEMINI.md'), '# gemini\n');
    writeFile(join(directory, 'README.md'), '# workspace\n');
    writeFile(join(directory, '.vscode/extensions.json'), '{}\n');
    writeFile(
      join(directory, '.gitignore'),
      `node_modules
.nx/cache
.nx/workspace-data
.cursor/rules/nx-rules.mdc
.github/instructions/nx.instructions.md

.claude/worktrees
.claude/settings.local.json
.nx/polygraph
`
    );
    writeFile(
      join(directory, 'AGENTS.md'),
      `<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

<!-- nx configuration end-->
`
    );
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('should remove agent files shipped by a template and keep the workspace', () => {
    removeTemplateAiAgents(directory);

    for (const relativePath of [
      '.agents',
      '.claude',
      '.codex',
      '.cursor',
      '.gemini',
      '.opencode',
      '.github/agents',
      '.github/prompts',
      '.github/skills',
      '.github/instructions',
      'opencode.json',
      'CLAUDE.md',
      'GEMINI.md',
      'AGENTS.md',
    ]) {
      expect(existsSync(join(directory, relativePath))).toBe(false);
    }

    expect(
      readFileSync(join(directory, '.github/workflows/ci.yml'), 'utf-8')
    ).toBe('name: CI\n');
    expect(readFileSync(join(directory, 'README.md'), 'utf-8')).toBe(
      '# workspace\n'
    );
    expect(existsSync(join(directory, '.vscode/extensions.json'))).toBe(true);
    expect(readFileSync(join(directory, '.gitignore'), 'utf-8')).toBe(
      `node_modules
.nx/cache
.nx/workspace-data

.nx/polygraph
`
    );
  });

  it('should keep content outside the Nx section of AGENTS.md', () => {
    writeFile(
      join(directory, 'AGENTS.md'),
      `# Project notes

Keep this.

<!-- nx configuration start-->
# General Guidelines for working with Nx
<!-- nx configuration end-->

## More notes
`
    );

    removeTemplateAiAgents(directory);

    expect(readFileSync(join(directory, 'AGENTS.md'), 'utf-8')).toBe(
      `# Project notes

Keep this.

## More notes
`
    );
  });

  it('should remove an empty .github directory when it only held agent files', () => {
    rmSync(join(directory, '.github/workflows'), { recursive: true });

    removeTemplateAiAgents(directory);

    expect(existsSync(join(directory, '.github'))).toBe(false);
  });

  it('should leave a workspace that has no agent files untouched', () => {
    const plain = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-plain-')));
    try {
      writeFile(join(plain, 'README.md'), '# workspace\n');
      writeFile(join(plain, '.github/workflows/ci.yml'), 'name: CI\n');

      removeTemplateAiAgents(plain);

      expect(readFileSync(join(plain, 'README.md'), 'utf-8')).toBe(
        '# workspace\n'
      );
      expect(
        readFileSync(join(plain, '.github/workflows/ci.yml'), 'utf-8')
      ).toBe('name: CI\n');
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });
});

function writeFile(path: string, contents: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents);
}
