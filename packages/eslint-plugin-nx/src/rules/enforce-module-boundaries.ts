import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';
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
  matchImportWithWildcard,
  onlyLoadChildren,
} from '@nrwl/workspace/src/utils/runtime-lint-utils';
import {
  AST_NODE_TYPES,
  TSESTree,
} from '@typescript-eslint/experimental-utils';
import { createESLintRule } from '../utils/create-eslint-rule';
import { normalizePath } from '@nrwl/devkit';
import {
  isNpmProject,
  ProjectGraph,
  ProjectType,
} from '@nrwl/workspace/src/core/project-graph';
import { readNxJson } from '@nrwl/workspace/src/core/file-utils';
import { TargetProjectLocator } from '@nrwl/workspace/src/core/target-project-locator';
import { checkCircularPath } from '@nrwl/workspace/src/utils/graph-utils';
import { readCurrentProjectGraph } from '@nrwl/workspace/src/core/project-graph/project-graph';
import { isRelativePath } from '@nrwl/workspace/src/utilities/fileutils';

type Options = [
  {
    allow: string[];
    depConstraints: DepConstraint[];
    enforceBuildableLibDependency: boolean;
    allowCircularSelfDependency: boolean;
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
  | 'tagConstraintViolation';
export const RULE_NAME = 'enforce-module-boundaries';

export default createESLintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: `Ensure that module boundaries are respected within the monorepo`,
      category: 'Best Practices',
      recommended: 'error',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          enforceBuildableLibDependency: { type: 'boolean' },
          allowCircularSelfDependency: { type: 'boolean' },
          allow: [{ type: 'string' }],
          depConstraints: [
            {
              type: 'object',
              properties: {
                sourceTag: { type: 'string' },
                onlyDependOnLibsWithTags: [{ type: 'string' }],
              },
              additionalProperties: false,
            },
          ],
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noRelativeOrAbsoluteImportsAcrossLibraries: `Libraries cannot be imported by a relative or absolute path, and must begin with a npm scope`,
      noCircularDependencies: `Circular dependency between "{{sourceProjectName}}" and "{{targetProjectName}}" detected: {{path}}`,
      noSelfCircularDependencies: `Only relative imports are allowed within the project. Absolute import found: {{imp}}`,
      noImportsOfApps: 'Imports of apps are forbidden',
      noImportsOfE2e: 'Imports of e2e projects are forbidden',
      noImportOfNonBuildableLibraries:
        'Buildable libraries cannot import or export from non-buildable libraries',
      noImportsOfLazyLoadedLibraries: `Imports of lazy-loaded libraries are forbidden`,
      projectWithoutTagsCannotHaveDependencies: `A project without tags cannot depend on any libraries`,
      tagConstraintViolation: `A project tagged with "{{sourceTag}}" can only depend on libs tagged with {{allowedTags}}`,
    },
  },
  defaultOptions: [
    {
      allow: [],
      depConstraints: [],
      enforceBuildableLibDependency: false,
      allowCircularSelfDependency: false,
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
      (global as any).projectGraph = readCurrentProjectGraph();
    }

    if (!(global as any).projectGraph) {
      return {};
    }

    const npmScope = (global as any).npmScope;
    const projectGraph = (global as any).projectGraph as ProjectGraph;

    if (!(global as any).targetProjectLocator) {
      (global as any).targetProjectLocator = new TargetProjectLocator(
        projectGraph.nodes
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

      const sourceFilePath = getSourceFilePath(
        normalizePath(context.getFilename()),
        projectPath
      );

      // whitelisted import
      if (allow.some((a) => matchImportWithWildcard(a, imp))) {
        return;
      }

      // check for relative and absolute imports
      if (
        isRelativeImportIntoAnotherProject(
          imp,
          projectPath,
          projectGraph,
          sourceFilePath
        ) ||
        isAbsoluteImportIntoAnotherProject(imp)
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

      const sourceProject = findSourceProject(projectGraph, sourceFilePath);
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
        if (!allowCircularSelfDependency && !isRelativePath(imp)) {
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
      if (isNpmProject(targetProject)) {
        return;
      }
      // check constraints between libs and apps
      // check for circular dependency
      const circularPath = checkCircularPath(
        projectGraph,
        sourceProject,
        targetProject
      );
      if (circularPath.length !== 0) {
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
