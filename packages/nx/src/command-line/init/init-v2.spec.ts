import { detectPlugins } from './init-v2';

// Mock dependencies
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn((path: string) => {
    if (path === 'package.json') return true;
    return false;
  }),
}));

jest.mock('../../utils/fileutils', () => ({
  readJsonFile: jest.fn(),
  fileExists: jest.fn(() => false),
}));

import { readJsonFile } from '../../utils/fileutils';
const mockReadJsonFile = readJsonFile as jest.Mock;

jest.mock('../../utils/workspace-context', () => ({
  globWithWorkspaceContextSync: jest.fn(() => []),
}));

jest.mock('../../utils/output', () => ({
  output: { log: jest.fn() },
}));

describe('detectPlugins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
