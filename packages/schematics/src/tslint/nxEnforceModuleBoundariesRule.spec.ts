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
          name: 'myappName',
          root: 'libs/myapp',
          type: ProjectType.app,
          tags: [],
          architect: {},
          files: [`apps/myapp/src/main.ts`, `apps/myapp/blah.ts`]
        },
        {
          name: 'mylibName',
          root: 'libs/mylib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/mylib/src/index.ts`, `libs/mylib/src/deep.ts`]
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
          name: 'myappName',
          root: 'libs/myapp',
          type: ProjectType.app,
          tags: [],
          architect: {},
          files: [`apps/myapp/src/main.ts`, `apps/myapp/src/blah.ts`]
        },
        {
          name: 'myapp2Name',
          root: 'libs/myapp2',
          type: ProjectType.app,
          tags: [],
          architect: {},
          files: []
        },
        {
          name: 'myapp2-mylib',
          root: 'libs/myapp2/mylib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: ['libs/myapp2/mylib/src/index.ts']
        }
      ]
    );

    expect(failures.length).toEqual(0);
  });

  describe('depConstraints', () => {
    const projectNodes = [
      {
        name: 'apiName',
        root: 'libs/api',
        type: ProjectType.lib,
        tags: ['api', 'domain1'],
        architect: {},
        files: [`libs/api/src/index.ts`]
      },
      {
        name: 'implName',
        root: 'libs/impl',
        type: ProjectType.lib,
        tags: ['impl', 'domain1'],
        architect: {},
        files: [`libs/impl/src/index.ts`]
      },
      {
        name: 'impl2Name',
        root: 'libs/impl2',
        type: ProjectType.lib,
        tags: ['impl', 'domain1'],
        architect: {},
        files: [`libs/impl2/src/index.ts`]
      },
      {
        name: 'impl-domain2Name',
        root: 'libs/impl-domain2',
        type: ProjectType.lib,
        tags: ['impl', 'domain2'],
        architect: {},
        files: [`libs/impl-domain2/src/index.ts`]
      },
      {
        name: 'impl-both-domainsName',
        root: 'libs/impl-both-domains',
        type: ProjectType.lib,
        tags: ['impl', 'domain1', 'domain2'],
        architect: {},
        files: [`libs/impl-both-domains/src/index.ts`]
      },
      {
        name: 'untaggedName',
        root: 'libs/untagged',
        type: ProjectType.lib,
        tags: [],
        architect: {},
        files: [`libs/untagged/src/index.ts`]
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
        `${process.cwd()}/proj/libs/api/src/index.ts`,
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
        `${process.cwd()}/proj/libs/api/src/index.ts`,
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
        `${process.cwd()}/proj/libs/untagged/src/index.ts`,
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
        `${process.cwd()}/proj/libs/impl/src/index.ts`,
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
        `${process.cwd()}/proj/libs/impl/src/index.ts`,
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
        `${process.cwd()}/proj/libs/impl-both-domain/src/index.ts`,
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
        `${process.cwd()}/proj/libs/impl/src/index.ts`,
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
        `${process.cwd()}/proj/libs/api/src/index.ts`,
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
            name: 'mylibName',
            root: 'libs/mylib',
            type: ProjectType.lib,
            tags: [],
            architect: {},
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
            name: 'mylibName',
            root: 'libs/mylib',
            type: ProjectType.lib,
            tags: [],
            architect: {},
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
            name: 'mylibName',
            root: 'libs/mylib',
            type: ProjectType.lib,
            tags: [],
            architect: {},
            files: [`libs/mylib/src/main.ts`]
          },
          {
            name: 'otherName',
            root: 'libs/other',
            type: ProjectType.lib,
            tags: [],
            architect: {},
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
          name: 'mylibName',
          root: 'libs/mylib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
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
      import "@mycompany/mylib/src/another-file"
      import "@mycompany/other/src/blah"
      import "@mycompany/other/src/sublib/blah"
      `,
      [
        {
          name: 'mylibName',
          root: 'libs/mylib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/mylib/src/main.ts`, `libs/mylib/src/another-file.ts`]
        },
        {
          name: 'otherName',
          root: 'libs/other',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/other/src/blah.ts`]
        },
        {
          name: 'otherSublibName',
          root: 'libs/other/sublib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/other/sublib/src/blah.ts`]
        }
      ]
    );
    expect(failures[0].getFailure()).toEqual(
      'deep imports into libraries are forbidden'
    );
    expect(failures[1].getFailure()).toEqual(
      'deep imports into libraries are forbidden'
    );
    expect(failures[2].getFailure()).toEqual(
      'deep imports into libraries are forbidden'
    );
    expect(failures[2].getFailure()).toEqual(
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
          name: 'mylibName',
          root: 'libs/mylib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'otherName',
          root: 'libs/other',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/other/index.ts`]
        }
      ],
      {
        mylibName: [
          { projectName: 'otherName', type: DependencyType.loadChildren }
        ]
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
          name: 'mylibName',
          root: 'libs/mylib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'myappName',
          root: 'apps/myapp',
          type: ProjectType.app,
          tags: [],
          architect: {},
          files: [`apps/myapp/src/index.ts`]
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
          name: 'mylibName',
          root: 'libs/mylib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'anotherlibName',
          root: 'libs/anotherlib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/anotherlib/src/main.ts`]
        },
        {
          name: 'myappName',
          root: 'apps/myapp',
          type: ProjectType.app,
          tags: [],
          architect: {},
          files: [`apps/myapp/src/index.ts`]
        }
      ],
      {
        mylibName: [
          { projectName: 'anotherlibName', type: DependencyType.es6Import }
        ]
      }
    );
    expect(failures[0].getFailure()).toEqual(
      'Circular dependency between "anotherlibName" and "mylibName" detected'
    );
  });

  it('should error when circular dependency detected (indirect)', () => {
    const failures = runRule(
      {},
      `${process.cwd()}/proj/libs/mylib/src/main.ts`,
      'import "@mycompany/badcirclelib"',
      [
        {
          name: 'mylibName',
          root: 'libs/mylib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/mylib/src/main.ts`]
        },
        {
          name: 'anotherlibName',
          root: 'libs/anotherlib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/anotherlib/src/main.ts`]
        },
        {
          name: 'badcirclelibName',
          root: 'libs/badcirclelib',
          type: ProjectType.lib,
          tags: [],
          architect: {},
          files: [`libs/badcirclelib/src/main.ts`]
        },
        {
          name: 'myappName',
          root: 'apps/myapp',
          type: ProjectType.app,
          tags: [],
          architect: {},
          files: [`apps/myapp/index.ts`]
        }
      ],
      {
        mylibName: [
          { projectName: 'badcirclelibName', type: DependencyType.es6Import }
        ],
        badcirclelibName: [
          { projectName: 'anotherlibName', type: DependencyType.es6Import }
        ],
        anotherlibName: [
          { projectName: 'mylibName', type: DependencyType.es6Import }
        ]
      }
    );
    expect(failures[0].getFailure()).toEqual(
      'Circular dependency between "mylibName" and "badcirclelibName" detected'
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
