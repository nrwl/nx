import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import {
  DepConstraint,
  findConstraintsFor,
  findProjectUsingImport,
  findSourceProject,
  getSourceFilePath,
  hasBuildExecutor,
  hasNoneOfTheseTags,
  isAbsoluteImportIntoAnotherProject,
  isRelativeImportIntoAnotherProject,
  mapProjectGraphFiles,
  matchImportWithWildcard,
  onlyLoadChildren,
  MappedProjectGraph,
  hasBannedImport,
  isDirectDependency,
} from '@nrwl/workspace/src/utils/runtime-lint-utils';
import {
  AST_NODE_TYPES,
  TSESTree,
} from '@typescript-eslint/experimental-utils';
import { createESLintRule } from '../utils/create-eslint-rule';
import { normalizePath } from '@nrwl/devkit';
import {
  ProjectType,
  readCachedProjectGraph,
} from '@nrwl/workspace/src/core/project-graph';
import { readNxJson } from '@nrwl/workspace/src/core/file-utils';
import { TargetProjectLocator } from '@nrwl/workspace/src/core/target-project-locator';
import {
  checkCircularPath,
  findFilesInCircularPath,
} from '@nrwl/workspace/src/utils/graph-utils';
import { isRelativePath } from '@nrwl/workspace/src/utilities/fileutils';
import { isSecondaryEntrypoint as isAngularSecondaryEntrypoint } from '../utils/angular';

type Options = [
  {
    allow: string[];
    depConstraints: DepConstraint[];
    enforceBuildableLibDependency: boolean;
    allowCircularSelfDependency: boolean;
    banTransitiveDependencies: boolean;
  }
];
export type MessageIds =
  | 'noRelativeOrAbsoluteImportsAcrossLibraries'
  | 'noSelfCircularDependencies'
  | 'noCircularDependencies'
  | 'noImportsOfApps'
  | 'noImportsOfE2e'
  | 'noImportOfNonBuildableLibraries'
  | 'noImportsOfLazyLoadedLibraries'
  | 'projectWithoutTagsCannotHaveDependencies'
  | 'tagConstraintViolation'
  | 'bannedExternalImportsViolation'
  | 'noTransitiveDependencies';
export const RULE_NAME = 'enforce-module-boundaries';

export default createESLintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: `Ensure that module boundaries are respected within the monorepo`,
      recommended: 'error',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          enforceBuildableLibDependency: { type: 'boolean' },
          allowCircularSelfDependency: { type: 'boolean' },
          banTransitiveDependencies: { type: 'boolean' },
          allow: [{ type: 'string' }],
          depConstraints: [
            {
              type: 'object',
              properties: {
                sourceTag: { type: 'string' },
                onlyDependOnLibsWithTags: [{ type: 'string' }],
                bannedExternalImports: [{ type: 'string' }],
              },
              additionalProperties: false,
            },
          ],
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noRelativeOrAbsoluteImportsAcrossLibraries: `Projects cannot be imported by a relative or absolute path, and must begin with a npm scope`,
      noCircularDependencies: `Circular dependency between "{{sourceProjectName}}" and "{{targetProjectName}}" detected: {{path}}\n\nCircular file chain:\n{{filePaths}}`,
      noSelfCircularDependencies: `Projects should use relative imports to import from other files within the same project. Use "./path/to/file" instead of import from "{{imp}}"`,
      noImportsOfApps: 'Imports of apps are forbidden',
      noImportsOfE2e: 'Imports of e2e projects are forbidden',
      noImportOfNonBuildableLibraries:
        'Buildable libraries cannot import or export from non-buildable libraries',
      noImportsOfLazyLoadedLibraries: `Imports of lazy-loaded libraries are forbidden`,
      projectWithoutTagsCannotHaveDependencies: `A project without tags matching at least one constraint cannot depend on any libraries`,
      tagConstraintViolation: `A project tagged with "{{sourceTag}}" can only depend on libs tagged with {{allowedTags}}`,
      bannedExternalImportsViolation: `A project tagged with "{{sourceTag}}" is not allowed to import the "{{package}}" package`,
      noTransitiveDependencies: `Transitive dependencies are not allowed. Only packages defined in the "package.json" can be imported`,
    },
  },
  defaultOptions: [
    {
      allow: [],
      depConstraints: [],
      enforceBuildableLibDependency: false,
      allowCircularSelfDependency: false,
      banTransitiveDependencies: false,
    },
  ],
  create(
    context,
    [
      {
        allow,
        depConstraints,
        enforceBuildableLibDependency,
        allowCircularSelfDependency,
        banTransitiveDependencies,
      },
    ]
  ) {
    /**
     * Globally cached info about workspace
     */
    const projectPath = normalizePath(
      (global as any).projectPath || appRootPath
    );
    if (!(global as any).projectGraph) {
      const nxJson = readNxJson();
      (global as any).npmScope = nxJson.npmScope;
      (global as any).workspaceLayout = nxJson.workspaceLayout;

      /**
       * Because there are a number of ways in which the rule can be invoked (executor vs ESLint CLI vs IDE Plugin),
       * the ProjectGraph may or may not exist by the time the lint rule is invoked for the first time.
       */
      try {
        (global as any).projectGraph = mapProjectGraphFiles(
          readCachedProjectGraph()
        );
      } catch {}
    }

    if (!(global as any).projectGraph) {
      return {};
    }

    const npmScope = (global as any).npmScope;
    const workspaceLayout = (global as any).workspaceLayout;
    const projectGraph = (global as any).projectGraph as MappedProjectGraph;

    if (!(global as any).targetProjectLocator) {
      (global as any).targetProjectLocator = new TargetProjectLocator(
        projectGraph.nodes,
        projectGraph.externalNodes
      );
    }
    const targetProjectLocator = (global as any)
      .targetProjectLocator as TargetProjectLocator;

    function run(
      node:
        | TSESTree.ImportDeclaration
        | TSESTree.ImportExpression
        | TSESTree.ExportAllDeclaration
        | TSESTree.ExportNamedDeclaration
    ) {
      // Ignoring ExportNamedDeclarations like:
      // export class Foo {}
      if (!node.source) {
        return;
      }

      // accept only literals because template literals have no value
      if (node.source.type !== AST_NODE_TYPES.Literal) {
        return;
      }

      const imp = node.source.value as string;

      // whitelisted import
      if (allow.some((a) => matchImportWithWildcard(a, imp))) {
        return;
      }

      const sourceFilePath = getSourceFilePath(
        context.getFilename(),
        projectPath
      );

      // check for relative and absolute imports
      const sourceProject = findSourceProject(projectGraph, sourceFilePath);
      if (
        isRelativeImportIntoAnotherProject(
          imp,
          projectPath,
          projectGraph,
          sourceFilePath,
          sourceProject
        ) ||
        isAbsoluteImportIntoAnotherProject(imp, workspaceLayout)
      ) {
        context.report({
          node,
          messageId: 'noRelativeOrAbsoluteImportsAcrossLibraries',
          data: {
            npmScope,
          },
        });
        return;
      }

      const targetProject = findProjectUsingImport(
        projectGraph,
        targetProjectLocator,
        sourceFilePath,
        imp,
        npmScope
      );

      // If source or target are not part of an nx workspace, return.
      if (!sourceProject || !targetProject) {
        return;
      }

      // same project => allow
      if (sourceProject === targetProject) {
        // we only allow relative paths within the same project
        // and if it's not a secondary entrypoint in an angular lib

        if (
          !allowCircularSelfDependency &&
          !isRelativePath(imp) &&
          !isAngularSecondaryEntrypoint(sourceFilePath)
        ) {
          context.report({
            node,
            messageId: 'noSelfCircularDependencies',
            data: {
              imp,
            },
          });
        }
        return;
      }

      // project => npm package
      if (targetProject.type === 'npm') {
        if (banTransitiveDependencies && !isDirectDependency(targetProject)) {
          context.report({
            node,
            messageId: 'noTransitiveDependencies',
          });
        }
        const constraint = hasBannedImport(
          sourceProject,
          targetProject,
          depConstraints
        );
        if (constraint) {
          context.report({
            node,
            messageId: 'bannedExternalImportsViolation',
            data: {
              sourceTag: constraint.sourceTag,
              package: targetProject.data.packageName,
            },
          });
        }
        return;
      }

      // check constraints between libs and apps
      // check for circular dependency
      const circularPath = checkCircularPath(
        (global as any).projectGraph,
        sourceProject,
        targetProject
      );
      if (circularPath.length !== 0) {
        const circularFilePath = findFilesInCircularPath(circularPath);

        context.report({
          node,
          messageId: 'noCircularDependencies',
          data: {
            sourceProjectName: sourceProject.name,
            targetProjectName: targetProject.name,
            path: circularPath.reduce(
              (acc, v) => `${acc} -> ${v.name}`,
              sourceProject.name
            ),
            filePaths: circularFilePath
              .map((files) =>
                files.length > 1 ? `[${files.join(',')}]` : files[0]
              )
              .reduce(
                (acc, files) => `${acc}\n- ${files}`,
                `- ${sourceFilePath}`
              ),
          },
        });
        return;
      }

      // cannot import apps
      if (targetProject.type === ProjectType.app) {
        context.report({
          node,
          messageId: 'noImportsOfApps',
        });
        return;
      }

      // cannot import e2e projects
      if (targetProject.type === ProjectType.e2e) {
        context.report({
          node,
          messageId: 'noImportsOfE2e',
        });
        return;
      }

      // buildable-lib is not allowed to import non-buildable-lib
      if (
        enforceBuildableLibDependency === true &&
        sourceProject.type === ProjectType.lib &&
        targetProject.type === ProjectType.lib
      ) {
        if (
          hasBuildExecutor(sourceProject) &&
          !hasBuildExecutor(targetProject)
        ) {
          context.report({
            node,
            messageId: 'noImportOfNonBuildableLibraries',
          });
          return;
        }
      }

      // if we import a library using loadChildren, we should not import it using es6imports
      if (
        node.type === AST_NODE_TYPES.ImportDeclaration &&
        node.importKind !== 'type' &&
        onlyLoadChildren(
          projectGraph,
          sourceProject.name,
          targetProject.name,
          []
        )
      ) {
        context.report({
          node,
          messageId: 'noImportsOfLazyLoadedLibraries',
        });
        return;
      }

      // check that dependency constraints are satisfied
      if (depConstraints.length > 0) {
        const constraints = findConstraintsFor(depConstraints, sourceProject);
        // when no constrains found => error. Force the user to provision them.
        if (constraints.length === 0) {
          context.report({
            node,
            messageId: 'projectWithoutTagsCannotHaveDependencies',
          });
          return;
        }

        for (let constraint of constraints) {
          if (
            hasNoneOfTheseTags(
              targetProject,
              constraint.onlyDependOnLibsWithTags || []
            )
          ) {
            const allowedTags = constraint.onlyDependOnLibsWithTags
              .map((s) => `"${s}"`)
              .join(', ');
            context.report({
              node,
              messageId: 'tagConstraintViolation',
              data: {
                sourceTag: constraint.sourceTag,
                allowedTags,
              },
            });
            return;
          }
        }
      }
    }

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        run(node);
      },
      ImportExpression(node: TSESTree.ImportExpression) {
        run(node);
      },
      ExportAllDeclaration(node: TSESTree.ExportAllDeclaration) {
        run(node);
      },
      ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
        run(node);
      },
    };
  },
});
