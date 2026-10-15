import {
  readDependsOnDirective,
  scopeTestTargetToProjects,
} from './test-file-depends-on';

describe('readDependsOnDirective', () => {
  it.each([
    [
      'merges several directives and drops duplicates',
      ['a, b', 'b,c'],
      { kind: 'projects', projects: ['a', 'b', 'c'] },
    ],
    [
      'reads a lowercase none as a project',
      ['none'],
      { kind: 'projects', projects: ['none'] },
    ],
    ['finds no entries', ['', ' , '], { kind: 'empty' }],
    ['reads NONE alone', ['NONE'], { kind: 'none' }],
    [
      'reads NONE repeated with empty entries as NONE alone',
      ['NONE,', 'NONE'],
      { kind: 'none' },
    ],
    ['rejects NONE with projects on one line', ['NONE, a'], { kind: 'mixed' }],
    [
      'rejects NONE with projects across lines',
      ['a', 'NONE'],
      { kind: 'mixed' },
    ],
  ])('%s', (_, values, expected) => {
    expect(readDependsOnDirective(values)).toEqual(expected);
  });
});

describe('scopeTestTargetToProjects', () => {
  it('replaces the dependency inputs with the listed projects and their dependencies, and drops server inputs', () => {
    expect(
      scopeTestTargetToProjects(
        {
          inputs: [
            'default',
            '^production',
            '^{projectRoot}/tsconfig*.json',
            { json: '{workspaceRoot}/tsconfig.base.json' },
          ],
          dependsOn: [
            { projects: ['app'], target: 'serve' },
            { target: 'e2e-ci--wait-for-webserver' },
            'build',
          ],
        },
        ['feature']
      )
    ).toEqual({
      inputs: [
        'default',
        { input: 'production', projects: ['feature'], always: true },
        {
          input: 'production',
          projects: ['feature'],
          dependencies: true,
          always: true,
        },
        { json: '{workspaceRoot}/tsconfig.base.json' },
      ],
      dependsOn: [
        { projects: ['app'], target: 'serve', inputs: false },
        { target: 'e2e-ci--wait-for-webserver' },
        'build',
      ],
    });
  });

  it('uses the named input of an object dependency input, else default', () => {
    expect(
      scopeTestTargetToProjects(
        { inputs: [{ input: 'e2e', dependencies: true }, 'default'] },
        ['a']
      ).inputs
    ).toEqual([
      { input: 'e2e', projects: ['a'], always: true },
      { input: 'e2e', projects: ['a'], dependencies: true, always: true },
      'default',
    ]);
    expect(
      scopeTestTargetToProjects(
        { inputs: ['default', '^{projectRoot}/**/*'] },
        ['a']
      ).inputs
    ).toEqual([
      'default',
      { input: 'default', projects: ['a'], always: true },
      { input: 'default', projects: ['a'], dependencies: true, always: true },
    ]);
  });
});
