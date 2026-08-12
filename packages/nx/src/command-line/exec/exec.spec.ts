jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));
jest.mock('../../config/calculate-default-project-name', () => ({
  calculateDefaultProjectName: jest.fn(),
}));
jest.mock('../../config/configuration', () => ({
  readNxJson: jest.fn(() => ({})),
}));
jest.mock('../../project-graph/project-graph', () => ({
  createProjectGraphAsync: jest.fn(),
  readProjectsConfigurationFromProjectGraph: jest.fn(() => ({ projects: {} })),
}));
jest.mock('../../utils/command-line-utils', () => ({
  splitArgsIntoNxArgsAndOverrides: jest.fn(),
}));
jest.mock('../../utils/fileutils', () => ({
  readJsonFile: jest.fn(),
}));
jest.mock('../../utils/package-manager', () => ({
  detectPackageManager: jest.fn(),
  getPackageManagerCommand: jest.fn(),
}));
jest.mock('../../utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { calculateDefaultProjectName } from '../../config/calculate-default-project-name';
import { ProjectGraph } from '../../config/project-graph';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { splitArgsIntoNxArgsAndOverrides } from '../../utils/command-line-utils';
import { readJsonFile } from '../../utils/fileutils';
import {
  detectPackageManager,
  getPackageManagerCommand,
  type PackageManagerCommands,
} from '../../utils/package-manager';
import { nxExecCommand } from './exec';

describe('nx exec', () => {
  const projectGraph: ProjectGraph = {
    nodes: {
      child: {
        name: 'child',
        type: 'lib',
        data: {
          root: 'packages/child',
          targets: { hello: {} },
        },
      },
    },
    dependencies: {},
  };

  let originalArgv: string[];
  let originalLifecycleEvent: string | undefined;
  let originalTargetProject: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();

    originalArgv = process.argv;
    originalLifecycleEvent = process.env.npm_lifecycle_event;
    originalTargetProject = process.env.NX_TASK_TARGET_PROJECT;

    process.argv = ['node', 'nx', 'exec', '--', 'echo', 'hi'];
    process.env.npm_lifecycle_event = 'hello';
    delete process.env.NX_TASK_TARGET_PROJECT;

    (createProjectGraphAsync as jest.Mock).mockResolvedValue(projectGraph);
    (splitArgsIntoNxArgsAndOverrides as jest.Mock).mockReturnValue({
      nxArgs: {},
      overrides: { __overrides_unparsed__: ['echo', 'hi'] },
    });
    (calculateDefaultProjectName as jest.Mock).mockReturnValue('child');
    (existsSync as jest.Mock).mockReturnValue(true);
    (readJsonFile as jest.Mock).mockReturnValue({
      scripts: { hello: 'nx exec -- echo hi' },
    });
    (detectPackageManager as jest.Mock).mockReturnValue('yarn');
    (getPackageManagerCommand as jest.Mock).mockReturnValue({
      exec: 'yarn',
    } as PackageManagerCommands);
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalLifecycleEvent === undefined) {
      delete process.env.npm_lifecycle_event;
    } else {
      process.env.npm_lifecycle_event = originalLifecycleEvent;
    }
    if (originalTargetProject === undefined) {
      delete process.env.NX_TASK_TARGET_PROJECT;
    } else {
      process.env.NX_TASK_TARGET_PROJECT = originalTargetProject;
    }
  });

  it('should detect the package manager from the workspace root', async () => {
    await nxExecCommand({});

    expect(detectPackageManager).toHaveBeenCalledWith('/root');
    expect(getPackageManagerCommand).toHaveBeenCalledWith('yarn');
  });

  it('should run the nx target from the workspace root', async () => {
    await nxExecCommand({});

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('yarn nx run child:'),
      expect.objectContaining({ cwd: '/root' })
    );
  });
});
