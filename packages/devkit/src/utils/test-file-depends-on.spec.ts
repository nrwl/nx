import {
  parseNxDependsOnDirective,
  scopeTestTargetToProjects,
} from './test-file-depends-on';

describe('parseNxDependsOnDirective', () => {
  it('merges several directives and drops duplicates', () => {
    expect(
      parseNxDependsOnDirective(
        '// @nx-depends-on: a, b\n// @nx-other: x\n// @nx-depends-on: b,c\n'
      )
    ).toEqual(['a', 'b', 'c']);
  });

  it('returns no projects for a directive that lists none', () => {
    expect(parseNxDependsOnDirective('// @nx-depends-on:\n')).toEqual([]);
  });

  it('returns undefined without a directive', () => {
    expect(parseNxDependsOnDirective('')).toBeUndefined();
    expect(
      parseNxDependsOnDirective('// nx-depends-on: a\n// @nx-depends-onx: b\n')
    ).toBeUndefined();
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
