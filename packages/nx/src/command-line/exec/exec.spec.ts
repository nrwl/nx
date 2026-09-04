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
import { withEnvironmentVariables } from '../../internal-testing-utils/with-environment';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { splitArgsIntoNxArgsAndOverrides } from '../../utils/command-line-utils';
import { readJsonFile } from '../../utils/fileutils';
import {
  detectPackageManager,
  getPackageManagerCommand,
  type PackageManagerCommands,
} from '../../utils/package-manager';
import { nxExecCommand } from './exec';

// A package script that calls `nx exec` runs with the project directory as its
// cwd, so the re-invocation nx builds has to name the workspace root itself
// rather than inherit that cwd — both for the package manager it picks and for
// the directory it spawns in.
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

  // `npm_lifecycle_event` is the package script nx was invoked from, and an
  // unset NX_TASK_TARGET_PROJECT is what tells nx it is not already running
  // inside a task, so it re-invokes itself for that script's project.
  const packageScriptEnv = {
    npm_lifecycle_event: 'hello',
    NX_TASK_TARGET_PROJECT: undefined,
  };

  const originalArgv = process.argv;

  beforeEach(() => {
    jest.clearAllMocks();

    process.argv = ['node', 'nx', 'exec', '--', 'echo', 'hi'];

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
  });

  it('should detect the package manager from the workspace root', async () => {
    await withEnvironmentVariables(packageScriptEnv, () => nxExecCommand({}));

    expect(detectPackageManager).toHaveBeenCalledWith('/root');
    expect(getPackageManagerCommand).toHaveBeenCalledWith('yarn');
  });

  it('should run the nx target from the workspace root', async () => {
    await withEnvironmentVariables(packageScriptEnv, () => nxExecCommand({}));

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('yarn nx run child:'),
      expect.objectContaining({ cwd: '/root' })
    );
  });
});
