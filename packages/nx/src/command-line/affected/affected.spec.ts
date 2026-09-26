import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../project-graph/affected/affected-project-graph', () => ({
  filterAffected: vi.fn(),
}));
vi.mock('../../project-graph/file-utils', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  calculateFileChanges: () => [],
}));

// The handler's other collaborators, mocked at their boundary so the tests
// below drive affected() itself.
vi.mock('../../project-graph/project-graph', () => ({
  createProjectGraphAsync: async () => projectGraph,
}));
vi.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
vi.mock('../nx-cloud/connect/connect-to-nx-cloud', () => ({
  connectToNxCloudIfExplicitlyAsked: async () => {},
}));
vi.mock('../../utils/command-line-utils', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  splitArgsIntoNxArgsAndOverrides: (args: object) => ({
    nxArgs: args,
    overrides: {},
  }),
}));
const runCommand = vi.hoisted(() => vi.fn());
vi.mock('../../tasks-runner/run-command', () => ({
  runCommand,
  runnerInputsForSelection: async () => ({}),
  selectTasksForProjects: vi.fn(),
}));
const tasks = vi.hoisted(() => ({
  enabled: false,
  computeAffectedTasks: vi.fn(),
}));
vi.mock('../../project-graph/affected/affected-tasks', () => ({
  selectsAffectedTasks: () => tasks.enabled,
  computeAffectedTasks: tasks.computeAffectedTasks,
}));

import { affected } from './affected';

const projectGraph = { nodes: {}, dependencies: {}, externalNodes: {} } as any;

describe('nx affected --explain', () => {
  const taskExplanation = {
    affected: {
      'app:build': [{ kind: 'dependent-output', producer: 'ui:build' }],
      'ui:build': [{ kind: 'input-file', file: 'libs/ui/src/x.ts' }],
    },
    upstream: {},
  };
  let written: string[];

  beforeEach(() => {
    performance.mark = vi.fn();
    performance.measure = vi.fn();
    written = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
      written.push(String(chunk));
      return true;
    });
    vi.spyOn(console, 'log').mockImplementation((line: any) => {
      written.push(String(line));
    });
    // Explaining ends the process, so stop there rather than fall through.
    vi.spyOn(process, 'exit').mockImplementation(((code: number) => {
      throw new Error(`exit ${code}`);
    }) as any);
    tasks.computeAffectedTasks.mockResolvedValue({
      projectGraph,
      affectedTaskIds: new Set(Object.keys(taskExplanation.affected)),
      taskSelection: {
        taskIds: ['app:build', 'ui:build', 'ui:prebuild'],
        initiatingTaskIds: ['app:build', 'ui:build'],
        taskGraph: { tasks: {}, dependencies: {}, roots: [] },
      },
      taskGraph: {
        tasks: {
          'app:build': { id: 'app:build', target: { project: 'nx' } },
          'ui:build': { id: 'ui:build', target: { project: 'devkit' } },
        },
        dependencies: {},
        roots: [],
      },
      explanation: taskExplanation,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    tasks.enabled = false;
  });

  const run = (args: object) =>
    affected('affected', {
      targets: ['build'],
      files: ['libs/ui/src/x.ts'],
      ...args,
    });

  it('reports the tasks and their closure, then exits without running', async () => {
    tasks.enabled = true;
    await expect(run({ explain: true })).rejects.toThrow('exit 0');

    expect(tasks.computeAffectedTasks).toHaveBeenCalledWith(
      expect.objectContaining({ explain: true })
    );
    expect(runCommand).not.toHaveBeenCalled();
    expect(written.join('')).toContain(
      '2 affected tasks and 1 task they depend on.'
    );
  });

  it('prints the task explanation as JSON for stdout', async () => {
    tasks.enabled = true;
    await expect(run({ explain: 'stdout' })).rejects.toThrow('exit 0');
    expect(JSON.parse(written.join(''))).toEqual(taskExplanation);
  });

  // Project selection has no task layers to explain.
  it('refuses to explain when projects are selected', async () => {
    await expect(run({ explain: true })).rejects.toThrow(
      'needs task selection'
    );
    expect(runCommand).not.toHaveBeenCalled();
  });
});
