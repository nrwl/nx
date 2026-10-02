import {
  parseNxDependsOnDirective,
  scopeTestTargetToProjects,
} from './test-file-depends-on';

describe('parseNxDependsOnDirective', () => {
  it('reads a line comment directive', () => {
    expect(
      parseNxDependsOnDirective(
        '// @nx-depends-on: feature, feature-utils\nimport { test } from "x";\n'
      )
    ).toEqual(['feature', 'feature-utils']);
  });

  it('reads a directive inside a leading block comment', () => {
    expect(
      parseNxDependsOnDirective(
        '/**\n * Checkout flow.\n * @nx-depends-on: checkout\n */\ntest();\n'
      )
    ).toEqual(['checkout']);
    expect(
      parseNxDependsOnDirective('/* @nx-depends-on: checkout */\ntest();\n')
    ).toEqual(['checkout']);
  });

  it('skips blank lines, a shebang and other comments before the directive', () => {
    expect(
      parseNxDependsOnDirective(
        '#!/usr/bin/env node\n\n// Copyright\n\n// @nx-depends-on: a\n'
      )
    ).toEqual(['a']);
  });

  it('merges several directives and drops duplicates', () => {
    expect(
      parseNxDependsOnDirective(
        '// @nx-depends-on: a, b\r\n// @nx-depends-on: b,c\r\n'
      )
    ).toEqual(['a', 'b', 'c']);
  });

  it('stops at the first line that is not a comment', () => {
    expect(
      parseNxDependsOnDirective('import x from "y";\n// @nx-depends-on: a\n')
    ).toBeUndefined();
    expect(
      parseNxDependsOnDirective(
        '/* header */ const x = 1;\n// @nx-depends-on: a\n'
      )
    ).toBeUndefined();
    expect(
      parseNxDependsOnDirective('test("// @nx-depends-on: a", () => {});\n')
    ).toBeUndefined();
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
