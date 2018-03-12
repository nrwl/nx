import { RuleFailure } from 'tslint';
import * as ts from 'typescript';

import { Rule } from './nxEnforceModuleBoundariesRule';
import {Dependency, DependencyType, ProjectNode, ProjectType} from '../command-line/affected-apps';

describe('Enforce Module Boundaries', () => {
  it('should not error when everything is in order', () => {
    const failures = runRule(
      { allow: ['@mycompany/mylib/deep'] },
      `${process.cwd()}/proj/apps/myapp/src/main.ts`,
      `
        import '@mycompany/mylib';
        import '@mycompany/mylib/deep';
        import '../blah';
      `,
      [
        {
          name: 'myapp',
          root: 'libs/myapp/src',
          type: ProjectType.app,
          files: [
            `apps/myapp/src/main.ts`,
            `apps/myapp/blah.ts`
          ]
        },
        {
          name: 'mylib',
          root: 'libs/mylib/src',
          type: ProjectType.lib,
          files: [
            `libs/mylib/index.ts`,
            `libs/mylib/deep.ts`
          ]
        }
      ]
    );

    expect(failures.length).toEqual(0);
  });

  describe('relative imports', () => {
    it('should not error when relatively importing the same library', () => {
      const failures = runRule(
        {},
        `${process.cwd()}/proj/libs/mylib/src/main.ts`,
        'import "../other"',
        [
          {
            name: 'mylib',
            root: 'libs/mylib/src',
            type: ProjectType.lib,
            files: [
              `libs/mylib/src/main.ts`,
              `libs/mylib/other.ts`
            ]
          }
        ]
      );
      expect(failures.length).toEqual(0);
    });

    it('should not error when relatively importing the same library (index file)', () => {
      const failures = runRule(
        {},
        `${process.cwd()}/proj/libs/mylib/src/main.ts`,
        'import "../other"',
        [
          {
            name: 'mylib',
            root: 'libs/mylib/src',
            type: ProjectType.lib,
            files: [
              `libs/mylib/src/main.ts`,
              `libs/mylib/other/index.ts`
            ]
          }
        ]
      );
      expect(failures.length).toEqual(0);
    });

    it('should error when relatively importing another library', () => {
      const failures = runRule(
        {},
        `${process.cwd()}/proj/libs/mylib/src/main.ts`,
        'import "../other"',
        [
          {
            name: 'mylib',
            root: 'libs/mylib/src',
            type: ProjectType.lib,
            files: [`libs/mylib/src/main.ts`]
          },
          {
            name: 'other',
            root: 'libs/other/src',
            type: ProjectType.lib,
            files: []
          }
        ]
      );
      expect(failures[0].getFailure()).toEqual(
        'library imports must start with @mycompany/'
      );
    });
  });

  it('should error on absolute imports into libraries without using the npm scope', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      'import "libs/src/other.ts"',
      [
        {
          name: 'mylib',
          root: 'libs/mylib/src',
          type: ProjectType.lib,
          files: [
            `libs/mylib/src/main.ts`,
            `libs/mylib/src/other.ts`
          ]
        }
      ]
    );

    expect(failures.length).toEqual(1);
    expect(failures[0].getFailure()).toEqual(
      'library imports must start with @mycompany/'
    );
  });

  it('should error about deep imports into libraries', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      'import "@mycompany/other/blah"',
      [
        {
          name: 'mylib',
          root: 'libs/mylib/src',
          type: ProjectType.lib,
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'other',
          root: 'libs/other/src',
          type: ProjectType.lib,
          files: [`libs/other/blah.ts`]
        }
      ]
    );
    expect(failures[0].getFailure()).toEqual(
      'deep imports into libraries are forbidden'
    );
  });

  it('should error on importing a lazy-loaded library', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      'import "@mycompany/other";',
      [
        {
          name: 'mylib',
          root: 'libs/mylib/src',
          type: ProjectType.lib,
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'other',
          root: 'libs/other/src',
          type: ProjectType.lib,
          files: [`libs/other/index.ts`]
        }
      ],
      {
        mylib: [{projectName: 'other', type: DependencyType.loadChildren}]
      }
    );
    expect(failures[0].getFailure()).toEqual('imports of lazy-loaded libraries are forbidden');
  });

  it('should error on importing an app', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      'import "@mycompany/myapp"',
      [
        {
          name: 'mylib',
          root: 'libs/mylib/src',
          type: ProjectType.lib,
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'myapp',
          root: 'apps/myapp/src',
          type: ProjectType.app,
          files: [`apps/myapp/index.ts`]
        }
      ]
    );
    expect(failures[0].getFailure()).toEqual(
      'imports of apps are forbidden'
    );
  });
});

function runRule(
  ruleArguments: any,
  contentPath: string,
  content: string,
  projectNodes: ProjectNode[],
  deps: { [projectName: string]: Dependency[] } = {}
): RuleFailure[] {
  const options: any = {
    ruleArguments: [ruleArguments],
    ruleSeverity: 'error',
    ruleName: 'enforceModuleBoundaries'
  };

  const sourceFile = ts.createSourceFile(
    contentPath,
    content,
    ts.ScriptTarget.Latest,
    true
  );
  const rule = new Rule(options, `${process.cwd()}/proj`, 'mycompany', projectNodes, deps);
  return rule.apply(sourceFile);
}