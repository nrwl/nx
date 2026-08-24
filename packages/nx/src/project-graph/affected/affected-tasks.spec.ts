import type { ProjectGraph } from '../../config/project-graph';
import type { ProjectConfiguration } from '../../config/workspace-json-project-json';
import { DeletedFileChange, WholeFileChange } from '../file-utils';
import {
  filterAffectedTasksByInputs,
  type RequestedTask,
} from './affected-tasks';

describe('filterAffectedTasksByInputs', () => {
  const task: RequestedTask = { project: 'app', target: 'build' };

  it('matches self inputs and honors exclusions', () => {
    const graph = graphWith({
      app: project('app', 'apps/app', [
        '{projectRoot}/**/*',
        '!{projectRoot}/**/*.spec.ts',
      ]),
    });

    expect(filter(graph, task, 'apps/app/src/main.ts')).toEqual([task]);
    expect(filter(graph, task, 'apps/app/src/main.spec.ts')).toEqual([]);
  });

  it('matches workspace inputs', () => {
    const graph = graphWith({
      app: project('app', 'apps/app', ['{workspaceRoot}/tools/schema.txt']),
    });

    expect(filter(graph, task, 'tools/schema.txt')).toHaveLength(1);
  });

  it('uses default self and dependency inputs', () => {
    const graph = graphWith(
      {
        app: project('app', 'apps/app'),
        lib: project('lib', 'libs/lib'),
      },
      { app: ['lib'] }
    );

    expect(filter(graph, task, 'apps/app/src/main.ts')).toHaveLength(1);
    expect(filter(graph, task, 'libs/lib/src/index.ts')).toHaveLength(1);
  });

  it('evaluates transitive dependency named inputs using each dependency project', () => {
    const graph = graphWith(
      {
        app: project('app', 'apps/app', ['^production']),
        middle: project('middle', 'libs/middle', undefined, {
          production: ['{projectRoot}/src/**/*'],
        }),
        leaf: project('leaf', 'libs/leaf', undefined, {
          production: ['{projectRoot}/source/**/*'],
        }),
      },
      { app: ['middle'], middle: ['leaf'] }
    );

    expect(filter(graph, task, 'libs/leaf/source/index.ts')).toEqual([task]);
  });

  it('honors dependency named input exclusions', () => {
    const graph = graphWith(
      {
        app: project('app', 'apps/app', ['^production']),
        lib: project('lib', 'libs/lib', undefined, {
          production: ['{projectRoot}/**/*', '!{projectRoot}/**/*.spec.ts'],
        }),
      },
      { app: ['lib'] }
    );

    expect(filter(graph, task, 'libs/lib/src/index.spec.ts')).toEqual([]);
  });

  it('matches explicit project inputs without expanding the candidates', () => {
    const graph = graphWith({
      app: project('app', 'apps/app', [
        { input: 'schema', projects: ['schema'] },
      ]),
      schema: project('schema', 'tools/schema', undefined, {
        schema: ['{projectRoot}/**/*.json'],
      }),
    });

    expect(filter(graph, task, 'tools/schema/model.json')).toEqual([task]);
  });

  it('resolves project input selectors', () => {
    const graph = graphWith({
      app: project('app', 'apps/app', [
        { input: 'schema', projects: ['tag:schema'] },
      ]),
      schema: {
        ...project('schema', 'tools/schema', undefined, {
          schema: ['{projectRoot}/**/*.json'],
        }),
        tags: ['schema'],
      },
    });

    expect(filter(graph, task, 'tools/schema/model.json')).toHaveLength(1);
  });

  it('matches deleted paths without reading the current file', () => {
    const graph = graphWith({ app: project('app', 'apps/app') });
    const result = filterAffectedTasksByInputs(taskList(task), graph, {}, [
      {
        file: 'apps/app/src/deleted.ts',
        getChanges: () => [new DeletedFileChange()],
      },
    ]);

    expect(result).toHaveLength(1);
  });

  it('handles root projects', () => {
    const graph = graphWith({
      app: project('app', '.', ['{projectRoot}/src/**/*']),
    });

    expect(filter(graph, task, 'src/main.ts')).toHaveLength(1);
  });

  it('conservatively retains unsupported inputs', () => {
    const graph = graphWith({
      app: project('app', 'apps/app', [{ runtime: 'node --version' }]),
    });

    expect(filter(graph, task, 'unrelated.txt')).toEqual([task]);
  });

  it('conservatively retains task configuration changes', () => {
    const graph = graphWith({
      app: project('app', 'apps/app', ['{projectRoot}/src/**/*']),
    });

    expect(filter(graph, task, 'apps/app/vite.config.ts')).toEqual([task]);
  });

  it('does not retain a task for another project configuration change', () => {
    const graph = graphWith({
      app: project('app', 'apps/app', ['{projectRoot}/src/**/*']),
      lib: project('lib', 'libs/lib'),
    });

    expect(filter(graph, task, 'libs/lib/vite.config.ts')).toEqual([]);
  });

  it('conservatively retains dependency project configuration changes', () => {
    const graph = graphWith(
      {
        app: project('app', 'apps/app'),
        lib: project('lib', 'libs/lib'),
      },
      { app: ['lib'] }
    );

    expect(filter(graph, task, 'libs/lib/project.json')).toEqual([task]);
  });

  it('conservatively retains tasks for an unowned project configuration change', () => {
    const graph = graphWith({
      app: project('app', 'apps/app', ['{projectRoot}/src/**/*']),
    });

    expect(filter(graph, task, 'apps/deleted/project.json')).toEqual([task]);
  });
});

function filter(graph: ProjectGraph, task: RequestedTask, changedPath: string) {
  return filterAffectedTasksByInputs(taskList(task), graph, {}, [
    { file: changedPath, getChanges: () => [new WholeFileChange()] },
  ]);
}

function taskList(task: RequestedTask): RequestedTask[] {
  return [task];
}

function project(
  name: string,
  root: string,
  inputs?: ProjectConfiguration['targets'][string]['inputs'],
  namedInputs?: ProjectConfiguration['namedInputs']
): ProjectConfiguration {
  return {
    name,
    root,
    namedInputs,
    targets: { build: { inputs } },
  };
}

function graphWith(
  projects: Record<string, ProjectConfiguration>,
  dependencies: Record<string, string[]> = {}
): ProjectGraph {
  return {
    nodes: Object.fromEntries(
      Object.entries(projects).map(([name, data]) => [
        name,
        { name, type: 'lib', data },
      ])
    ),
    externalNodes: {},
    dependencies: Object.fromEntries(
      Object.keys(projects).map((name) => [
        name,
        (dependencies[name] ?? []).map((target) => ({
          source: name,
          target,
          type: 'static',
        })),
      ])
    ),
  };
}
