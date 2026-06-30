import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { readNxJson } from '../../config/configuration';
import {
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { fileExists } from '../../utils/fileutils';
import { handleImport } from '../../utils/handle-import';
import { getIgnoreObject } from '../../utils/ignore';
import { readModulePackageJson } from '../../utils/package-json';
import { workspaceRoot } from '../../utils/workspace-root';
import { format } from './format';

jest.mock('node:child_process', () => ({
  exec: jest.fn(),
  execSync: jest.fn(),
}));

jest.mock('../../config/configuration', () => ({
  readNxJson: jest.fn(() => ({})),
}));

jest.mock('../../plugins/js/utils/typescript', () => ({
  getRootTsConfigFileName: jest.fn(() => 'tsconfig.base.json'),
  getRootTsConfigPath: jest.fn(() => 'tsconfig.base.json'),
}));

jest.mock('../../utils/command-line-utils', () => ({
  getProjectRoots: jest.fn(),
  parseFiles: jest.fn(),
  splitArgsIntoNxArgsAndOverrides: jest.fn(),
}));

jest.mock('../../utils/fileutils', () => ({
  fileExists: jest.fn(),
  readJsonFile: jest.fn(),
  writeJsonFile: jest.fn(),
}));

jest.mock('../../utils/handle-import', () => ({
  handleImport: jest.fn(),
}));

jest.mock('../../utils/ignore', () => ({
  getIgnoreObject: jest.fn(),
}));

jest.mock('../../utils/package-json', () => ({
  readModulePackageJson: jest.fn(),
}));

describe('format', () => {
  const prettier = {
    version: '3.6.2',
    getSupportInfo: jest.fn(),
    getFileInfo: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (handleImport as jest.Mock).mockResolvedValue(prettier);
    (readNxJson as jest.Mock).mockReturnValue({});
    (splitArgsIntoNxArgsAndOverrides as jest.Mock).mockReturnValue({
      nxArgs: {},
    });
    (fileExists as jest.Mock).mockReturnValue(true);
    (getIgnoreObject as jest.Mock).mockReturnValue({
      filter: (patterns: string[]) => patterns,
    });
    (readModulePackageJson as jest.Mock).mockReturnValue({
      packageJson: {
        bin: {
          prettier: 'bin/prettier.cjs',
        },
      },
      path: join(workspaceRoot, 'node_modules/prettier/package.json'),
    });
  });

  it('formats files supported by Prettier plugins', async () => {
    const svelteFile = join(workspaceRoot, 'component.svelte');

    (parseFiles as jest.Mock).mockReturnValue({
      files: [svelteFile],
    });
    prettier.getSupportInfo.mockResolvedValue({
      languages: [{ extensions: ['.ts'] }],
    });
    prettier.getFileInfo.mockResolvedValue({
      ignored: false,
      inferredParser: 'svelte',
    });

    await format('write', { _: [], files: svelteFile } as any);

    expect(prettier.getFileInfo).toHaveBeenCalledWith(svelteFile, {
      resolveConfig: true,
    });
    expect(
      (execSync as jest.Mock).mock.calls.map(([command]) => command).join('\n')
    ).toContain('component.svelte');
  });
});
