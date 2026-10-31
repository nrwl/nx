import {
  createWorkspace,
  extractConnectUrl,
  resolveTemplateShorthand,
} from './create-workspace';
import { downloadTemplate } from './utils/template/download-template';
import type { Mock } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('./utils/template/download-template', () => ({
  downloadTemplate: vi.fn(),
}));

vi.mock('./utils/child-process-utils', () => ({
  execAndWait: vi.fn(async () => undefined),
}));

vi.mock('./utils/ai/ai-output', () => ({
  isAiAgent: () => true,
  logProgress: () => undefined,
}));

describe('createWorkspace - template flow', () => {
  it('refuses to overwrite an existing directory unless scaffolding in place', async () => {
    const tmpDir = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-cw-')));
    mkdirSync(join(tmpDir, 'existing'));
    try {
      await expect(
        createWorkspace(undefined, {
          template: 'nrwl/empty-template',
          name: 'existing',
          workingDir: tmpDir,
          packageManager: 'npm',
          nxCloud: 'skip',
        } as any)
      ).rejects.toMatchObject({ code: 'DIRECTORY_EXISTS' });
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects templates that escape the nrwl org via path traversal', async () => {
    for (const template of [
      'nrwl/../evil',
      'nrwl/../../evil/repo',
      'nrwl/..\\evil\\repo',
      'nrwl/',
    ]) {
      await expect(
        createWorkspace(undefined, {
          template,
          name: 'proj',
          packageManager: 'npm',
          nxCloud: 'skip',
          workingDir: tmpdir(),
        } as any)
      ).rejects.toThrow(/Invalid template/);
    }
  });

  it('should strip template AI agent files when --aiAgents=none was passed', async () => {
    const { root, workspace } = await scaffoldTemplate({ aiAgents: ['none'] });
    try {
      expect(existsSync(join(workspace, '.claude'))).toBe(false);
      expect(existsSync(join(workspace, '.agents'))).toBe(false);
      expect(existsSync(join(workspace, '.cursor'))).toBe(false);
      expect(existsSync(join(workspace, '.github/agents'))).toBe(false);
      expect(existsSync(join(workspace, 'CLAUDE.md'))).toBe(false);
      expect(existsSync(join(workspace, 'AGENTS.md'))).toBe(false);
      expect(existsSync(join(workspace, 'opencode.json'))).toBe(false);
      expect(
        readFileSync(join(workspace, '.github/workflows/ci.yml'), 'utf-8')
      ).toBe('name: CI\n');
      expect(readFileSync(join(workspace, 'README.md'), 'utf-8')).toBe(
        '# workspace\n'
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should keep template AI agent files when the flag is omitted', async () => {
    const { root, workspace } = await scaffoldTemplate({});
    try {
      expect(existsSync(join(workspace, '.claude/settings.json'))).toBe(true);
      expect(existsSync(join(workspace, 'AGENTS.md'))).toBe(true);
      expect(existsSync(join(workspace, '.github/workflows/ci.yml'))).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('should strip template AI agent files when a direct caller passes an empty list', async () => {
    const { root, workspace } = await scaffoldTemplate(undefined, []);
    try {
      expect(existsSync(join(workspace, '.claude'))).toBe(false);
      expect(existsSync(join(workspace, '.github/workflows/ci.yml'))).toBe(
        true
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('extractConnectUrl', () => {
  test('should extract the correct URL from the given string', () => {
    const inputString = `
         NX   Your Nx Cloud workspace is ready.

        To claim it, connect it to your Nx Cloud account:
        - Push your repository to your git hosting provider.
        - Go to the following URL to connect your workspace to Nx Cloud:

        https://staging.nx.app/connect/O8dfB0jYgvd
        `;
    const expectedUrl = 'https://staging.nx.app/connect/O8dfB0jYgvd';
    expect(extractConnectUrl(inputString)).toBe(expectedUrl);
  });

  test('should return null if no URL is present', () => {
    const inputString = `
         NX   Your Nx Cloud workspace is ready.

        To claim it, connect it to your Nx Cloud account:
        - Push your repository to your git hosting provider.
        - Go to the following URL to connect your workspace to Nx Cloud:

        No URL here.
        `;
    expect(extractConnectUrl(inputString)).toBeNull();
  });

  test('should handle URLs with different domains and paths', () => {
    const inputString = `
         NX   Your Nx Cloud workspace is ready.

        To claim it, connect it to your Nx Cloud account:
        - Push your repository to your git hosting provider.
        - Go to the following URL to connect your workspace to Nx Cloud:

        https://example.com/connect/abcd1234
        `;
    const expectedUrl = 'https://example.com/connect/abcd1234';
    expect(extractConnectUrl(inputString)).toBe(expectedUrl);
  });

  test('should handle URLs with query parameters and fragments', () => {
    const inputString = `
         NX   Your Nx Cloud workspace is ready.

        To claim it, connect it to your Nx Cloud account:
        - Push your repository to your git hosting provider.
        - Go to the following URL to connect your workspace to Nx Cloud:

        https://example.com/connect/abcd1234?query=param#fragment
        `;
    const expectedUrl =
      'https://example.com/connect/abcd1234?query=param#fragment';
    expect(extractConnectUrl(inputString)).toBe(expectedUrl);
  });
});

describe('resolveTemplateShorthand', () => {
  test('should resolve angular shorthand', () => {
    expect(resolveTemplateShorthand('angular')).toBe('nrwl/angular-template');
  });

  test('should resolve react shorthand', () => {
    expect(resolveTemplateShorthand('react')).toBe('nrwl/react-template');
  });

  test('should resolve typescript shorthand', () => {
    expect(resolveTemplateShorthand('typescript')).toBe(
      'nrwl/typescript-template'
    );
  });

  test('should resolve empty shorthand', () => {
    expect(resolveTemplateShorthand('empty')).toBe('nrwl/empty-template');
  });

  test('should pass through full template names unchanged', () => {
    expect(resolveTemplateShorthand('nrwl/angular-template')).toBe(
      'nrwl/angular-template'
    );
  });

  test('should pass through unknown values unchanged', () => {
    expect(resolveTemplateShorthand('nrwl/custom-template')).toBe(
      'nrwl/custom-template'
    );
  });
});

async function scaffoldTemplate(
  rawArgs: { aiAgents?: string[] } | undefined,
  aiAgents?: string[]
): Promise<{ root: string; workspace: string }> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cnw-ai-')));
  (downloadTemplate as Mock).mockImplementation(
    async (_template: string, directory: string) => {
      writeTemplateFile(join(directory, '.agents/skills/SKILL.md'), '#\n');
      writeTemplateFile(join(directory, '.claude/settings.json'), '{}\n');
      writeTemplateFile(join(directory, '.cursor/skills/SKILL.md'), '#\n');
      writeTemplateFile(join(directory, '.github/agents/ci.agent.md'), '#\n');
      writeTemplateFile(
        join(directory, '.github/workflows/ci.yml'),
        'name: CI\n'
      );
      writeTemplateFile(join(directory, 'opencode.json'), '{}\n');
      writeTemplateFile(join(directory, 'CLAUDE.md'), '# claude\n');
      writeTemplateFile(
        join(directory, 'AGENTS.md'),
        `<!-- nx configuration start-->
# Nx
<!-- nx configuration end-->
`
      );
      writeTemplateFile(join(directory, 'README.md'), '# workspace\n');
      writeTemplateFile(
        join(directory, 'package.json'),
        '{"name":"example"}\n'
      );
    }
  );

  const normalizedAgents =
    aiAgents ?? rawArgs?.aiAgents?.filter((agent) => agent !== 'none') ?? [];

  try {
    await createWorkspace(
      undefined,
      {
        template: 'nrwl/empty-template',
        name: 'example',
        workingDir: root,
        packageManager: 'npm',
        nxCloud: 'skip',
        skipGit: true,
        aiAgents: normalizedAgents,
      } as any,
      rawArgs as any
    );
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }

  return { root, workspace: join(root, 'example') };
}

function writeTemplateFile(path: string, contents: string): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents);
}
