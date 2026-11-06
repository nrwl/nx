import type { Mock } from 'vitest';
import { detectPlugins, initHandler } from './init-v2';

// Mock dependencies
vi.mock('fs', async () => ({
  ...require('fs'),
  existsSync: vi.fn((path: string) => {
    if (path === 'package.json') return true;
    return false;
  }),
}));

vi.mock('../../utils/fileutils', () => ({
  readJsonFile: vi.fn(),
  fileExists: vi.fn(() => false),
}));

import { readJsonFile } from '../../utils/fileutils';
const mockReadJsonFile = readJsonFile as Mock;

vi.mock('../../utils/workspace-context', () => ({
  globWithWorkspaceContextSync: vi.fn(() => []),
}));

vi.mock('../../utils/output', () => ({
  output: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Everything below is only needed to drive `initHandler` through the non-AI
// path. The pieces that touch the file system, the network or a package
// manager are stubbed out.
vi.mock('../../native', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../native')>()),
  isAiAgent: vi.fn(() => false),
}));

vi.mock('../../config/nx-json', () => ({
  readNxJson: vi.fn(() => ({ plugins: [] })),
}));

vi.mock('../../utils/ab-testing', () => ({ recordStat: vi.fn() }));

vi.mock('../../utils/prompt-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/prompt-helpers')>()),
  selectPrompt: vi.fn(async () => 'Guided'),
  multiselectPrompt: vi.fn(async () => []),
}));

vi.mock('./ai-agent-prompts', () => ({
  determineAiAgents: vi.fn(async () => []),
}));

vi.mock('./configure-plugins', () => ({
  installPluginPackages: vi.fn(),
  configurePlugins: vi.fn(async () => {}),
}));

vi.mock('./implementation/add-nx-to-npm-repo', () => ({
  addNxToNpmRepo: vi.fn(async () => {}),
}));

vi.mock('./implementation/format', () => ({
  formatInitWrites: vi.fn(async () => {}),
  recordInitWrite: vi.fn(),
}));

vi.mock('./implementation/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./implementation/utils')>()),
  createNxJsonFile: vi.fn(),
  updateGitIgnore: vi.fn(),
  printFinalMessage: vi.fn(),
}));

import { multiselectPrompt, selectPrompt } from '../../utils/prompt-helpers';
import { configurePlugins, installPluginPackages } from './configure-plugins';
const mockSelectPrompt = selectPrompt as Mock;
const mockMultiselectPrompt = multiselectPrompt as Mock;
const mockInstallPluginPackages = installPluginPackages as Mock;
const mockConfigurePlugins = configurePlugins as Mock;

describe('detectPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not suggest a plugin that is already installed as an npm dependency', async () => {
    const packageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { vite: '^5.0.0' },
      devDependencies: { '@nx/vite': '19.0.0' },
    };
    mockReadJsonFile.mockReturnValue(packageJson);

    const result = await detectPlugins({ plugins: [] }, packageJson, false);

    expect(result.plugins).not.toContain('@nx/vite');
  });

  it('should suggest a plugin when the tool is installed but the nx plugin is not', async () => {
    const packageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { vite: '^5.0.0' },
      devDependencies: {},
    };
    mockReadJsonFile.mockReturnValue(packageJson);

    const result = await detectPlugins({ plugins: [] }, packageJson, false);

    expect(result.plugins).toContain('@nx/vite');
  });

  it('should not suggest a plugin already listed in nx.json plugins', async () => {
    const packageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { vite: '^5.0.0' },
      devDependencies: {},
    };
    mockReadJsonFile.mockReturnValue(packageJson);

    const result = await detectPlugins(
      { plugins: ['@nx/vite'] },
      packageJson,
      false
    );

    expect(result.plugins).not.toContain('@nx/vite');
  });
});

describe('initHandler --plugins flag (non-AI mode)', () => {
  // A project with eslint and vite so there is more than one plugin to detect.
  const packageJson = {
    name: 'test',
    version: '1.0.0',
    devDependencies: { eslint: '^9.0.0', vite: '^5.0.0' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NX_USE_LOCAL = 'true';
    mockReadJsonFile.mockReturnValue(packageJson);
  });

  afterEach(() => {
    delete process.env.NX_USE_LOCAL;
  });

  it('should not install any plugin when --plugins=skip', async () => {
    await initHandler({
      interactive: false,
      nxCloud: false,
      plugins: 'skip',
    });

    expect(mockInstallPluginPackages).not.toHaveBeenCalled();
    expect(mockConfigurePlugins).not.toHaveBeenCalled();
  });

  it('should install every detected plugin without prompting when --plugins=all', async () => {
    await initHandler({ interactive: true, nxCloud: false, plugins: 'all' });

    expect(mockMultiselectPrompt).not.toHaveBeenCalled();
    expect(mockInstallPluginPackages).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.arrayContaining(['@nx/eslint', '@nx/vite'])
    );
  });

  it('should only install the plugins listed in --plugins', async () => {
    await initHandler({
      interactive: false,
      nxCloud: false,
      plugins: '@nx/eslint',
    });

    expect(mockInstallPluginPackages).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      ['@nx/eslint']
    );
    expect(mockConfigurePlugins).toHaveBeenCalledWith(
      ['@nx/eslint'],
      true,
      expect.anything(),
      expect.anything(),
      undefined
    );
  });

  it('should skip the minimum/guided question and honor --plugins when interactive', async () => {
    await initHandler({
      interactive: true,
      nxCloud: false,
      plugins: '@nx/vite',
    });

    expect(mockSelectPrompt).not.toHaveBeenCalled();
    expect(mockInstallPluginPackages).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      ['@nx/vite']
    );
  });
});
