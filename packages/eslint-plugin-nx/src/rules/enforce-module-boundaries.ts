import {
  workspaceRoot,
  joinPathFragments,
  normalizePath,
  ProjectGraphExternalNode,
  readCachedProjectGraph,
  readNxJson,
} from '@nrwl/devkit';
import {
  DepConstraint,
  findConstraintsFor,
  findDependenciesWithTags,
  findProjectUsingImport,
  findSourceProject,
  getSourceFilePath,
  getTargetProjectBasedOnRelativeImport,
  groupImports,
  hasBannedImport,
  hasBuildExecutor,
  hasNoneOfTheseTags,
  isAbsoluteImportIntoAnotherProject,
  isAngularSecondaryEntrypoint,
  isDirectDependency,
  isTerminalRun,
  MappedProjectGraph,
  MappedProjectGraphNode,
  mapProjectGraphFiles,
  matchImportWithWildcard,
  onlyLoadChildren,
  stringifyTags,
} from '@nrwl/workspace/src/utils/runtime-lint-utils';
import {
  AST_NODE_TYPES,
  TSESTree,
} from '@typescript-eslint/experimental-utils';
import { createESLintRule } from '../utils/create-eslint-rule';
import { TargetProjectLocator } from 'nx/src/core/target-project-locator';
import {
  checkCircularPath,
  findFilesInCircularPath,
} from '@nrwl/workspace/src/utils/graph-utils';
import { isRelativePath } from '@nrwl/workspace/src/utilities/fileutils';
import * as chalk from 'chalk';
import { basename, dirname, relative } from 'path';
import {
  getBarrelEntryPointByImportScope,
  getBarrelEntryPointProjectNode,
  getRelativeImportPath,
} from '../utils/ast-utils';

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
  | 'bannedExternalImportsViolation'
  | 'noTransitiveDependencies'
  | 'onlyTagsConstraintViolation'
  | 'notTagsConstraintViolation';
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
                notDependOnLibsWithTags: [{ type: 'string' }],
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
      bannedExternalImportsViolation: `A project tagged with "{{sourceTag}}" is not allowed to import the "{{package}}" package`,
      noTransitiveDependencies: `Transitive dependencies are not allowed. Only packages defined in the "package.json" can be imported`,
      onlyTagsConstraintViolation: `A project tagged with "{{sourceTag}}" can only depend on libs tagged with {{tags}}`,
      notTagsConstraintViolation: `A project tagged with "{{sourceTag}}" can not depend on libs tagged with {{tags}}\n\nViolation detected in:\n{{projects}}`,
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
      (global as any).projectPath || workspaceRoot
    );
    /**
     * Only reuse graph when running from terminal
     * Enforce every IDE change to get a fresh nxdeps.json
     */
    if (!(global as any).projectGraph || !isTerminalRun()) {
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
      } catch {
        const WARNING_PREFIX = `${chalk.reset.keyword('orange')('warning')}`;
        const RULE_NAME_SUFFIX = `${chalk.reset.dim(
          '@nrwl/nx/enforce-module-boundaries'
        )}`;
        process.stdout
          .write(`${WARNING_PREFIX} No cached ProjectGraph is available. The rule will be skipped.
        If you encounter this error as part of running standard \`nx\` commands then please open an issue on https://github.com/nrwl/nx
        ${RULE_NAME_SUFFIX}\n`);
      }
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

      const sourceProject = findSourceProject(projectGraph, sourceFilePath);
      // If source is not part of an nx workspace, return.
      if (!sourceProject) {
        return;
      }

      // check for relative and absolute imports
      let targetProject: MappedProjectGraphNode | ProjectGraphExternalNode =
        getTargetProjectBasedOnRelativeImport(
          imp,
          projectPath,
          projectGraph,
          sourceFilePath
        );
      if (
        (targetProject && sourceProject !== targetProject) ||
        isAbsoluteImportIntoAnotherProject(imp, workspaceLayout)
      ) {
        context.report({
          node,
          messageId: 'noRelativeOrAbsoluteImportsAcrossLibraries',
          data: {
            npmScope,
          },
          fix(fixer) {
            if (targetProject) {
              const indexTsPaths = getBarrelEntryPointProjectNode(
                targetProject as MappedProjectGraphNode
              );

              if (indexTsPaths && indexTsPaths.length > 0) {
                const specifiers = (node as any).specifiers;
                if (!specifiers || specifiers.length === 0) {
                  return;
                }

                const imports = specifiers.map((s) => s.imported.name);

                // process each potential entry point and try to find the imports
                const importsToRemap = [];

                for (const entryPointPath of indexTsPaths) {
                  for (const importMember of imports) {
                    const importPath = getRelativeImportPath(
                      importMember,
                      entryPointPath.path,
                      sourceProject.data.sourceRoot
                    );

                    importsToRemap.push({
                      member: importMember,
                      importPath: importPath ? entryPointPath.importScope : imp, // we cannot remap, so leave it as is
                    });
                  }
                }

                const adjustedRelativeImports = groupImports(importsToRemap);

                if (adjustedRelativeImports !== '') {
                  return fixer.replaceTextRange(
                    node.range,
                    adjustedRelativeImports
                  );
                }
              }
            }
          },
        });
        return;
      }

      targetProject =
        targetProject ||
        findProjectUsingImport(
          projectGraph,
          targetProjectLocator,
          sourceFilePath,
          imp,
          npmScope
        );

      // If target is not part of an nx workspace, return.
      if (!targetProject) {
        return;
      }

      // we only allow relative paths within the same project
      // and if it's not a secondary entrypoint in an angular lib
      if (sourceProject === targetProject) {
        if (
          !allowCircularSelfDependency &&
          !isRelativePath(imp) &&
          !isAngularSecondaryEntrypoint(targetProjectLocator, imp)
        ) {
          context.report({
            node,
            messageId: 'noSelfCircularDependencies',
            data: {
              imp,
            },
            fix(fixer) {
              // imp has form of @myorg/someproject/some/path
              const indexTsPaths = getBarrelEntryPointByImportScope(imp);
              if (indexTsPaths && indexTsPaths.length > 0) {
                const specifiers = (node as any).specifiers;
                if (!specifiers || specifiers.length === 0) {
                  return;
                }
                // imported JS functions to remap
                const imports = specifiers.map((s) => s.imported.name);

                // process each potential entry point and try to find the imports
                const importsToRemap = [];

                for (const entryPointPath of indexTsPaths) {
                  for (const importMember of imports) {
                    const importPath = getRelativeImportPath(
                      importMember,
                      entryPointPath,
                      sourceProject.data.sourceRoot
                    );
                    if (importPath) {
                      // resolve the import path
                      const relativePath = relative(
                        dirname(context.getFilename()),
                        dirname(importPath)
                      );

                      // if the string is empty, it's the current file
                      const importPathResolved =
                        relativePath === ''
                          ? `./${basename(importPath)}`
                          : joinPathFragments(
                              relativePath,
                              basename(importPath)
                            );

                      importsToRemap.push({
                        member: importMember,
                        importPath: importPathResolved.replace('.ts', ''),
                      });
                    }
                  }
                }

                const adjustedRelativeImports = groupImports(importsToRemap);
                if (adjustedRelativeImports !== '') {
                  return fixer.replaceTextRange(
                    node.range,
                    adjustedRelativeImports
                  );
                }
              }
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

        // spacer text used for indirect dependencies when printing one line per file.
        // without this, we can end up with a very long line that does not display well in the terminal.
        const spacer = '  ';

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
                files.length > 1
                  ? `[${files
                      .map((f) => `\n${spacer}${spacer}${f}`)
                      .join(',')}\n${spacer}]`
                  : files[0]
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
      if (targetProject.type === 'app') {
        context.report({
          node,
          messageId: 'noImportsOfApps',
        });
        return;
      }

      // cannot import e2e projects
      if (targetProject.type === 'e2e') {
        context.report({
          node,
          messageId: 'noImportsOfE2e',
        });
        return;
      }

      // buildable-lib is not allowed to import non-buildable-lib
      if (
        enforceBuildableLibDependency === true &&
        sourceProject.type === 'lib' &&
        targetProject.type === 'lib'
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
            constraint.onlyDependOnLibsWithTags &&
            constraint.onlyDependOnLibsWithTags.length &&
            hasNoneOfTheseTags(
              targetProject,
              constraint.onlyDependOnLibsWithTags
            )
          ) {
            context.report({
              node,
              messageId: 'onlyTagsConstraintViolation',
              data: {
                sourceTag: constraint.sourceTag,
                tags: stringifyTags(constraint.onlyDependOnLibsWithTags),
              },
            });
            return;
          }
          if (
            constraint.notDependOnLibsWithTags &&
            constraint.notDependOnLibsWithTags.length
          ) {
            const projectPaths = findDependenciesWithTags(
              targetProject,
              constraint.notDependOnLibsWithTags,
              projectGraph
            );
            if (projectPaths.length > 0) {
              context.report({
                node,
                messageId: 'notTagsConstraintViolation',
                data: {
                  sourceTag: constraint.sourceTag,
                  tags: stringifyTags(constraint.notDependOnLibsWithTags),
                  projects: projectPaths
                    .map(
                      (projectPath) =>
                        `- ${projectPath.map((p) => p.name).join(' -> ')}`
                    )
                    .join('\n'),
                },
              });
              return;
            }
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
