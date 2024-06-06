import {
  joinPathFragments,
  normalizePath,
  NX_VERSION,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
  workspaceRoot,
} from '@nx/devkit';
import {
  AST_NODE_TYPES,
  ESLintUtils,
  TSESTree,
} from '@typescript-eslint/utils';
import { isBuiltinModuleImport } from '@nx/js/src/internal';
import { isRelativePath } from 'nx/src/utils/fileutils';
import { basename, dirname, join, relative } from 'path';
import {
  getBarrelEntryPointByImportScope,
  getBarrelEntryPointProjectNode,
  getRelativeImportPath,
} from '../utils/ast-utils';
import {
  checkCircularPath,
  findFilesInCircularPath,
  findFilesWithDynamicImports,
} from '../utils/graph-utils';
import { readProjectGraph } from '../utils/project-graph-utils';
import {
  appIsMFERemote,
  belongsToDifferentNgEntryPoint,
  DepConstraint,
  findConstraintsFor,
  findDependenciesWithTags,
  findProject,
  findProjectUsingImport,
  findTransitiveExternalDependencies,
  getSourceFilePath,
  getTargetProjectBasedOnRelativeImport,
  groupImports,
  hasBannedDependencies,
  hasBannedImport,
  hasBuildExecutor,
  hasNoneOfTheseTags,
  hasStaticImportOfDynamicResource,
  isAbsoluteImportIntoAnotherProject,
  isComboDepConstraint,
  isDirectDependency,
  matchImportWithWildcard,
  stringifyTags,
} from '../utils/runtime-lint-utils';

type Options = [
  {
    allow: string[];
    buildTargets: string[];
    depConstraints: DepConstraint[];
    enforceBuildableLibDependency: boolean;
    allowCircularSelfDependency: boolean;
    checkDynamicDependenciesExceptions: string[];
    banTransitiveDependencies: boolean;
    checkNestedExternalImports: boolean;
  }
];
export type MessageIds =
  | 'noRelativeOrAbsoluteImportsAcrossLibraries'
  | 'noRelativeOrAbsoluteExternals'
  | 'noSelfCircularDependencies'
  | 'noCircularDependencies'
  | 'noImportsOfApps'
  | 'noImportsOfE2e'
  | 'noImportOfNonBuildableLibraries'
  | 'noImportsOfLazyLoadedLibraries'
  | 'projectWithoutTagsCannotHaveDependencies'
  | 'bannedExternalImportsViolation'
  | 'nestedBannedExternalImportsViolation'
  | 'noTransitiveDependencies'
  | 'onlyTagsConstraintViolation'
  | 'emptyOnlyTagsConstraintViolation'
  | 'notTagsConstraintViolation';
export const RULE_NAME = 'enforce-module-boundaries';

export default ESLintUtils.RuleCreator(
  () =>
    `https://github.com/nrwl/nx/blob/${NX_VERSION}/docs/generated/packages/eslint-plugin/documents/enforce-module-boundaries.md`
)<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: `Ensure that module boundaries are respected within the monorepo`,
      recommended: 'recommended',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          enforceBuildableLibDependency: { type: 'boolean' },
          allowCircularSelfDependency: { type: 'boolean' },
          checkDynamicDependenciesExceptions: {
            type: 'array',
            items: { type: 'string' },
          },
          banTransitiveDependencies: { type: 'boolean' },
          checkNestedExternalImports: { type: 'boolean' },
          allow: { type: 'array', items: { type: 'string' } },
          buildTargets: { type: 'array', items: { type: 'string' } },
          depConstraints: {
            type: 'array',
            items: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    sourceTag: { type: 'string' },
                    onlyDependOnLibsWithTags: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    allowedExternalImports: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    bannedExternalImports: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    notDependOnLibsWithTags: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  additionalProperties: false,
                },
                {
                  type: 'object',
                  properties: {
                    allSourceTags: {
                      type: 'array',
                      items: { type: 'string' },
                      minItems: 2,
                    },
                    onlyDependOnLibsWithTags: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    allowedExternalImports: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    bannedExternalImports: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    notDependOnLibsWithTags: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  additionalProperties: false,
                },
              ],
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noRelativeOrAbsoluteImportsAcrossLibraries: `Projects cannot be imported by a relative or absolute path, and must begin with a npm scope`,
      noRelativeOrAbsoluteExternals: `External resources cannot be imported using a relative or absolute path`,
      noCircularDependencies: `Circular dependency between "{{sourceProjectName}}" and "{{targetProjectName}}" detected: {{path}}\n\nCircular file chain:\n{{filePaths}}`,
      noSelfCircularDependencies: `Projects should use relative imports to import from other files within the same project. Use "./path/to/file" instead of import from "{{imp}}"`,
      noImportsOfApps: 'Imports of apps are forbidden',
      noImportsOfE2e: 'Imports of e2e projects are forbidden',
      noImportOfNonBuildableLibraries:
        'Buildable libraries cannot import or export from non-buildable libraries',
      noImportsOfLazyLoadedLibraries: `Static imports of lazy-loaded libraries are forbidden.\n\nLibrary "{{targetProjectName}}" is lazy-loaded in these files:\n{{filePaths}}`,
      projectWithoutTagsCannotHaveDependencies: `A project without tags matching at least one constraint cannot depend on any libraries`,
      bannedExternalImportsViolation: `A project tagged with "{{sourceTag}}" is not allowed to import "{{imp}}"`,
      nestedBannedExternalImportsViolation: `A project tagged with "{{sourceTag}}" is not allowed to import "{{imp}}". Nested import found at {{childProjectName}}`,
      noTransitiveDependencies: `Only packages defined in the "package.json" can be imported. Transitive or unresolvable dependencies are not allowed.`,
      onlyTagsConstraintViolation: `A project tagged with "{{sourceTag}}" can only depend on libs tagged with {{tags}}`,
      emptyOnlyTagsConstraintViolation:
        'A project tagged with "{{sourceTag}}" cannot depend on any libs with tags',
      notTagsConstraintViolation: `A project tagged with "{{sourceTag}}" can not depend on libs tagged with {{tags}}\n\nViolation detected in:\n{{projects}}`,
    },
  },
  defaultOptions: [
    {
      allow: [],
      buildTargets: ['build'],
      depConstraints: [],
      enforceBuildableLibDependency: false,
      allowCircularSelfDependency: false,
      checkDynamicDependenciesExceptions: [],
      banTransitiveDependencies: false,
      checkNestedExternalImports: false,
    },
  ],
  create(
    context,
    [
      {
        allow,
        buildTargets,
        depConstraints,
        enforceBuildableLibDependency,
        allowCircularSelfDependency,
        checkDynamicDependenciesExceptions,
        banTransitiveDependencies,
        checkNestedExternalImports,
      },
    ]
  ) {
    /**
     * Globally cached info about workspace
     */
    const projectPath = normalizePath(
      (global as any).projectPath || workspaceRoot
    );
    const fileName = normalizePath(context.filename ?? context.getFilename());

    const {
      projectGraph,
      projectRootMappings,
      projectFileMap,
      targetProjectLocator,
    } = readProjectGraph(RULE_NAME);

    if (!projectGraph) {
      return {};
    }

    const workspaceLayout = (global as any).workspaceLayout;

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

      const sourceFilePath = getSourceFilePath(fileName, projectPath);

      const sourceProject = findProject(
        projectGraph,
        projectRootMappings,
        sourceFilePath
      );
      // If source is not part of an nx workspace, return.
      if (!sourceProject) {
        return;
      }

      // check for relative and absolute imports
      const isAbsoluteImportIntoAnotherProj =
        isAbsoluteImportIntoAnotherProject(imp, workspaceLayout);
      let targetProject: ProjectGraphProjectNode | ProjectGraphExternalNode;

      if (isAbsoluteImportIntoAnotherProj) {
        targetProject = findProject(projectGraph, projectRootMappings, imp);
      } else {
        targetProject = getTargetProjectBasedOnRelativeImport(
          imp,
          projectPath,
          projectGraph,
          projectRootMappings,
          sourceFilePath
        );
      }

      if (
        (targetProject && sourceProject !== targetProject) ||
        isAbsoluteImportIntoAnotherProj
      ) {
        context.report({
          node,
          messageId: 'noRelativeOrAbsoluteImportsAcrossLibraries',
          fix(fixer) {
            if (targetProject) {
              const indexTsPaths = getBarrelEntryPointProjectNode(
                targetProject as ProjectGraphProjectNode
              );

              if (indexTsPaths && indexTsPaths.length > 0) {
                const specifiers = (node as any).specifiers;
                if (!specifiers || specifiers.length === 0) {
                  return;
                }

                const imports = specifiers
                  .filter((s) => s.type === 'ImportSpecifier')
                  .map((s) => s.imported.name);

                // process each potential entry point and try to find the imports
                const importsToRemap = [];

                for (const entryPointPath of indexTsPaths) {
                  for (const importMember of imports) {
                    const importPath = getRelativeImportPath(
                      importMember,
                      join(workspaceRoot, entryPointPath.path),
                      sourceProject.data.sourceRoot
                    );
                    // we cannot remap, so leave it as is
                    if (importPath) {
                      importsToRemap.push({
                        member: importMember,
                        importPath: entryPointPath.importScope,
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
          imp
        );

      if (!targetProject) {
        // non-project imports cannot use relative or absolute paths
        if (isRelativePath(imp) || imp.startsWith('/')) {
          context.report({
            node,
            messageId: 'noRelativeOrAbsoluteExternals',
          });
        } else if (banTransitiveDependencies && !isBuiltinModuleImport(imp)) {
          /**
           * At this point, the target project could not be found in the project graph, and it is not a relative or absolute import.
           * Therefore it could be an external/npm package dependency (but not a node built in module) which has not yet been installed
           * in the workspace.
           *
           * If the banTransitiveDependencies option is enabled, we should flag this case as an error because the user is trying to
           * depend on something which is not explicitly defined/resolvable on disk for their project.
           */
          context.report({
            node,
            messageId: 'noTransitiveDependencies',
          });
        }

        // If target is not found (including node internals) we bail early
        return;
      }

      // we only allow relative paths within the same project
      // and if it's not a secondary entrypoint in an angular lib
      if (sourceProject === targetProject) {
        if (
          !allowCircularSelfDependency &&
          !isRelativePath(imp) &&
          !belongsToDifferentNgEntryPoint(
            imp,
            sourceFilePath,
            sourceProject.data.root
          )
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
              if (indexTsPaths.length > 0) {
                const specifiers = (node as any).specifiers;
                if (!specifiers || specifiers.length === 0) {
                  return;
                }
                // imported JS functions to remap
                const imports = specifiers
                  .filter((s) => s.type === 'ImportSpecifier')
                  .map((s) => s.imported.name);

                // process each potential entry point and try to find the imports
                const importsToRemap = [];

                for (const entryPointPath of indexTsPaths) {
                  for (const importMember of imports) {
                    const importPath = getRelativeImportPath(
                      importMember,
                      join(workspaceRoot, entryPointPath),
                      sourceProject.data.sourceRoot
                    );
                    if (importPath) {
                      // resolve the import path
                      const relativePath = relative(
                        dirname(fileName),
                        dirname(importPath)
                      );

                      // the string we receive from elsewhere might not have a leading './' here despite still being a relative path
                      // we'd like to ensure it's a normalized relative form starting from ./ or ../
                      const ensureRelativeForm = (path: string): string =>
                        path.startsWith('./') || path.startsWith('../')
                          ? path
                          : `./${path}`;

                      // if the string is empty, it's the current file
                      const importPathResolved =
                        relativePath === ''
                          ? `./${basename(importPath)}`
                          : ensureRelativeForm(
                              joinPathFragments(
                                relativePath,
                                basename(importPath)
                              )
                            );

                      importsToRemap.push({
                        member: importMember,
                        // remove .ts or .tsx from the end of the file path
                        importPath: importPathResolved.replace(/.tsx?$/, ''),
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
        if (
          banTransitiveDependencies &&
          !isDirectDependency(sourceProject, targetProject)
        ) {
          context.report({
            node,
            messageId: 'noTransitiveDependencies',
          });
        }
        const constraint = hasBannedImport(
          sourceProject,
          targetProject,
          depConstraints,
          imp
        );
        if (constraint) {
          context.report({
            node,
            messageId: 'bannedExternalImportsViolation',
            data: {
              sourceTag: isComboDepConstraint(constraint)
                ? constraint.allSourceTags.join('" and "')
                : constraint.sourceTag,
              imp,
            },
          });
        }
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
        const circularFilePath = findFilesInCircularPath(
          projectFileMap,
          circularPath
        );

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
      if (targetProject.type === 'app' && !appIsMFERemote(targetProject)) {
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
          hasBuildExecutor(sourceProject, buildTargets) &&
          !hasBuildExecutor(targetProject, buildTargets)
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
        !checkDynamicDependenciesExceptions.some((a) =>
          matchImportWithWildcard(a, imp)
        ) &&
        hasStaticImportOfDynamicResource(
          node,
          projectGraph,
          sourceProject.name,
          targetProject.name
        )
      ) {
        const filesWithLazyImports = findFilesWithDynamicImports(
          projectFileMap,
          sourceProject.name,
          targetProject.name
        );
        context.report({
          data: {
            filePaths: filesWithLazyImports
              .map(({ file }) => `- ${file}`)
              .join('\n'),
            targetProjectName: targetProject.name,
          },
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

        const transitiveExternalDeps = checkNestedExternalImports
          ? findTransitiveExternalDependencies(projectGraph, targetProject)
          : [];

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
                sourceTag: isComboDepConstraint(constraint)
                  ? constraint.allSourceTags.join('" and "')
                  : constraint.sourceTag,
                tags: stringifyTags(constraint.onlyDependOnLibsWithTags),
              },
            });
            return;
          }
          if (
            constraint.onlyDependOnLibsWithTags &&
            constraint.onlyDependOnLibsWithTags.length === 0 &&
            targetProject.data.tags.length !== 0
          ) {
            context.report({
              node,
              messageId: 'emptyOnlyTagsConstraintViolation',
              data: {
                sourceTag: isComboDepConstraint(constraint)
                  ? constraint.allSourceTags.join('" and "')
                  : constraint.sourceTag,
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
                  sourceTag: isComboDepConstraint(constraint)
                    ? constraint.allSourceTags.join('" and "')
                    : constraint.sourceTag,
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
          if (
            checkNestedExternalImports &&
            constraint.bannedExternalImports &&
            constraint.bannedExternalImports.length
          ) {
            const matches = hasBannedDependencies(
              transitiveExternalDeps,
              projectGraph,
              constraint,
              imp
            );
            if (matches.length > 0) {
              matches.forEach(([target, violatingSource, constraint]) => {
                context.report({
                  node,
                  messageId: 'nestedBannedExternalImportsViolation',
                  data: {
                    sourceTag: isComboDepConstraint(constraint)
                      ? constraint.allSourceTags.join('" and "')
                      : constraint.sourceTag,
                    childProjectName: violatingSource.name,
                    imp,
                  },
                });
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
