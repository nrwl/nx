import { RuleFailure } from 'tslint';
import * as ts from 'typescript';

import { Rule } from './nxEnforceModuleBoundariesRule';
import {
  Dependency,
  DependencyType,
  ProjectNode,
  ProjectType
} from '../command-line/affected-apps';

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
          tags: [],
          files: [`apps/myapp/src/main.ts`, `apps/myapp/blah.ts`]
        },
        {
          name: 'mylib',
          root: 'libs/mylib/src',
          type: ProjectType.lib,
          tags: [],
          files: [`libs/mylib/index.ts`, `libs/mylib/dee1p.ts`]
        }
      ]
    );

    expect(failures.length).toEqual(0);
  });

  it('should handle multiple projects starting with the same prefix properly', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/apps/myapp/src/main.ts`,
      `
        import '@mycompany/myapp2/mylib';
      `,
      [
        {
          name: 'myapp',
          root: 'libs/myapp/src',
          type: ProjectType.app,
          tags: [],
          files: [`apps/myapp/src/main.ts`, `apps/myapp/blah.ts`]
        },
        {
          name: 'myapp2',
          root: 'libs/myapp2/src',
          type: ProjectType.app,
          tags: [],
          files: []
        },
        {
          name: 'myapp2/mylib',
          root: 'libs/myapp2/mylib/src',
          type: ProjectType.lib,
          tags: [],
          files: ['libs/myapp2/mylib/src/index.ts']
        }
      ]
    );

    expect(failures.length).toEqual(0);
  });

  describe('depConstraints', () => {
    const projectNodes = [
      {
        name: 'api',
        root: 'libs/api/src',
        type: ProjectType.lib,
        tags: ['api', 'domain1'],
        files: [`libs/api/index.ts`]
      },
      {
        name: 'impl',
        root: 'libs/impl/src',
        type: ProjectType.lib,
        tags: ['impl', 'domain1'],
        files: [`libs/impl/index.ts`]
      },
      {
        name: 'impl2',
        root: 'libs/impl2/src',
        type: ProjectType.lib,
        tags: ['impl', 'domain1'],
        files: [`libs/impl2/index.ts`]
      },
      {
        name: 'impl-domain2',
        root: 'libs/impl-domain2/src',
        type: ProjectType.lib,
        tags: ['impl', 'domain2'],
        files: [`libs/impl-domain2/index.ts`]
      },
      {
        name: 'impl-both-domains',
        root: 'libs/impl-both-domains/src',
        type: ProjectType.lib,
        tags: ['impl', 'domain1', 'domain2'],
        files: [`libs/impl-both-domains/index.ts`]
      },
      {
        name: 'untagged',
        root: 'libs/untagged/src',
        type: ProjectType.lib,
        tags: [],
        files: [`libs/untagged/index.ts`]
      }
    ];

    const depConstraints = {
      depConstraints: [
        { sourceTag: 'api', onlyDependOnLibsWithTags: ['api'] },
        { sourceTag: 'impl', onlyDependOnLibsWithTags: ['api', 'impl'] },
        { sourceTag: 'domain1', onlyDependOnLibsWithTags: ['domain1'] },
        { sourceTag: 'domain2', onlyDependOnLibsWithTags: ['domain2'] }
      ]
    };

    it('should error when the target library does not have the right tag', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/api/index.ts`,
        `
        import '@mycompany/impl';
      `,
        projectNodes
      );

      expect(failures[0].getFailure()).toEqual(
        'A project tagged with "api" can only depend on libs tagged with "api"'
      );
    });

    it('should error when the target library is untagged', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/api/index.ts`,
        `
        import '@mycompany/untagged';
      `,
        projectNodes
      );

      expect(failures[0].getFailure()).toEqual(
        'A project tagged with "api" can only depend on libs tagged with "api"'
      );
    });

    it('should error when the source library is untagged', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/untagged/index.ts`,
        `
        import '@mycompany/api';
      `,
        projectNodes
      );

      expect(failures[0].getFailure()).toEqual(
        'A project without tags cannot depend on any libraries'
      );
    });

    it('should check all tags', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/impl/index.ts`,
        `
        import '@mycompany/impl-domain2';
      `,
        projectNodes
      );

      expect(failures[0].getFailure()).toEqual(
        'A project tagged with "domain1" can only depend on libs tagged with "domain1"'
      );
    });

    it('should allow a domain1 project to depend on a project that is tagged with domain1 and domain2', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/impl/index.ts`,
        `
        import '@mycompany/impl-both-domains';
      `,
        projectNodes
      );

      expect(failures.length).toEqual(0);
    });

    it('should allow a domain1/domain2 project depend on domain1', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/impl-both-domain/index.ts`,
        `
        import '@mycompany/impl';
      `,
        projectNodes
      );

      expect(failures.length).toEqual(0);
    });

    it('should not error when the constraints are satisfied', () => {
      const failures = runRule(
        depConstraints,
        `${process.cwd()}/proj/libs/impl/index.ts`,
        `
        import '@mycompany/impl2';
      `,
        projectNodes
      );

      expect(failures.length).toEqual(0);
    });

    it('should support wild cards', () => {
      const failures = runRule(
        {
          depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }]
        },
        `${process.cwd()}/proj/libs/api/index.ts`,
        `
        import '@mycompany/impl';
      `,
        projectNodes
      );

      expect(failures.length).toEqual(0);
    });
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
            tags: [],
            files: [`libs/mylib/src/main.ts`, `libs/mylib/other.ts`]
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
            tags: [],
            files: [`libs/mylib/src/main.ts`, `libs/mylib/other/index.ts`]
          }
        ]
      );
      expect(failures.length).toEqual(0);
    });

    it('should error when relatively importing another library', () => {
      const failures = runRule(
        {},
        `${process.cwd()}/proj/libs/mylib/src/main.ts`,
        'import "../../other"',
        [
          {
            name: 'mylib',
            root: 'libs/mylib/src',
            type: ProjectType.lib,
            tags: [],
            files: [`libs/mylib/src/main.ts`]
          },
          {
            name: 'other',
            root: 'libs/other/src',
            type: ProjectType.lib,
            tags: [],
            files: ['libs/other/src/index.ts']
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
          tags: [],
          files: [`libs/mylib/src/main.ts`, `libs/mylib/src/other.ts`]
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
      `
      import "@mycompany/other/blah"
      import "@mycompany/other/sublib/blah"
      `,
      [
        {
          name: 'mylib',
          root: 'libs/mylib/src',
          type: ProjectType.lib,
          tags: [],
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'other',
          root: 'libs/other/src',
          type: ProjectType.lib,
          tags: [],
          files: [`libs/other/blah.ts`]
        },
        {
          name: 'other/sublib',
          root: 'libs/other/sublib/src',
          type: ProjectType.lib,
          tags: [],
          files: [`libs/other/sublib/blah.ts`]
        }
      ]
    );
    expect(failures[0].getFailure()).toEqual(
      'deep imports into libraries are forbidden'
    );
    expect(failures[1].getFailure()).toEqual(
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
          tags: [],
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'other',
          root: 'libs/other/src',
          type: ProjectType.lib,
          tags: [],
          files: [`libs/other/index.ts`]
        }
      ],
      {
        mylib: [{ projectName: 'other', type: DependencyType.loadChildren }]
      }
    );
    expect(failures[0].getFailure()).toEqual(
      'imports of lazy-loaded libraries are forbidden'
    );
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
          tags: [],
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'myapp',
          root: 'apps/myapp/src',
          type: ProjectType.app,
          tags: [],
          files: [`apps/myapp/index.ts`]
        }
      ]
    );
    expect(failures[0].getFailure()).toEqual('imports of apps are forbidden');
  });

  it('should error when circular dependency detected', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/anotherlib/src/main.ts`,
      'import "@mycompany/mylib"',
      [
        {
          name: 'mylib',
          root: 'libs/mylib/src',
          type: ProjectType.lib,
          tags: [],
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'anotherlib',
          root: 'libs/anotherlib/src',
          type: ProjectType.lib,
          tags: [],
          files: [`libs/anotherlib/src/main.ts`]
        },
        {
          name: 'myapp',
          root: 'apps/myapp/src',
          type: ProjectType.app,
          tags: [],
          files: [`apps/myapp/index.ts`]
        }
      ],
      {
        mylib: [{ projectName: 'anotherlib', type: DependencyType.es6Import }]
      }
    );
    expect(failures[0].getFailure()).toEqual(
      'Circular dependency between "anotherlib" and "mylib" detected'
    );
  });

  it('should error when circular dependency detected (indirect)', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      'import "@mycompany/badcirclelib"',
      [
        {
          name: 'mylib',
          root: 'libs/mylib/src',
          type: ProjectType.lib,
          tags: [],
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'anotherlib',
          root: 'libs/anotherlib/src',
          type: ProjectType.lib,
          tags: [],
          files: [`libs/anotherlib/src/main.ts`]
        },
        {
          name: 'badcirclelib',
          root: 'libs/badcirclelib/src',
          type: ProjectType.lib,
          tags: [],
          files: [`libs/badcirclelib/src/main.ts`]
        },
        {
          name: 'myapp',
          root: 'apps/myapp/src',
          type: ProjectType.app,
          tags: [],
          files: [`apps/myapp/index.ts`]
        }
      ],
      {
        mylib: [
          { projectName: 'badcirclelib', type: DependencyType.es6Import }
        ],
        badcirclelib: [
          { projectName: 'anotherlib', type: DependencyType.es6Import }
        ],
        anotherlib: [{ projectName: 'mylib', type: DependencyType.es6Import }]
      }
    );
    expect(failures[0].getFailure()).toEqual(
      'Circular dependency between "mylib" and "badcirclelib" detected'
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
  const rule = new Rule(
    options,
    `${process.cwd()}/proj`,
    'mycompany',
    projectNodes,
    deps
  );
  return rule.apply(sourceFile);
}
