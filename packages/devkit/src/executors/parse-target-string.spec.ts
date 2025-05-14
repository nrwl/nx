import { parseTargetString, targetToTargetString } from './parse-target-string';

import * as splitTarget from 'nx/src/utils/split-target';
import {
  ExecutorContext,
  ProjectGraph,
  readProjectsConfigurationFromProjectGraph,
} from 'nx/src/devkit-exports';

const cases = [
  { input: 'one:two', expected: { project: 'one', target: 'two' } },
  {
    input: 'one:two:three',
    expected: { project: 'one', target: 'two', configuration: 'three' },
  },
  {
    input: 'one:"two:two":three',
    expected: { project: 'one', target: 'two:two', configuration: 'three' },
  },
];

describe('parseTargetString', () => {
  const graph: ProjectGraph = {
    nodes: {
      'my-project': {
        type: 'lib',
        name: 'my-project',
        data: { root: '/packages/my-project' },
      },
      'other-project': {
        type: 'lib',
        name: 'other-project',
        data: { root: '/packages/other-project' },
      },
    },
    dependencies: {},
    externalNodes: {},
    version: '',
  };
  const mockContext: ExecutorContext = {
    projectName: 'my-project',
    cwd: '/virtual',
    root: '/virtual',
    isVerbose: false,
    projectGraph: graph,
    projectsConfigurations: readProjectsConfigurationFromProjectGraph(graph),
    nxJsonConfiguration: {},
  };

  it.each(cases)('$input -> $expected', ({ input, expected }) => {
    jest
      .spyOn(splitTarget, 'splitTarget')
      .mockReturnValueOnce(Object.values(expected) as [string]);
    expect(parseTargetString(input, null)).toEqual(expected);
  });

  it('should support reading project from ExecutorContext', () => {
    expect(parseTargetString('build', mockContext)).toEqual({
      project: 'my-project',
      target: 'build',
    });
    expect(parseTargetString('build:production', mockContext)).toEqual({
      project: 'my-project',
      target: 'build',
      configuration: 'production',
    });
    expect(parseTargetString('other-project:build', mockContext)).toEqual({
      project: 'other-project',
      target: 'build',
    });
  });

  // When running a converted executor, its possible that the context has a project name that
  // isn't present within the project graph. In these cases, this function should still behave predictably.
  it('should produce accurate results if the project graph doesnt contain the project', () => {
    expect(
      parseTargetString('foo:build', { ...mockContext, projectName: 'foo' })
    ).toEqual({
      project: 'foo',
      target: 'build',
    });
    expect(
      parseTargetString('foo:build:production', {
        ...mockContext,
        projectName: 'foo',
      })
    ).toEqual({
      project: 'foo',
      target: 'build',
      configuration: 'production',
    });
  });
});

describe('targetToTargetString', () => {
  it.each(cases)('$expected -> $input', ({ input, expected }) => {
    expect(targetToTargetString(expected)).toEqual(input);
  });
});
