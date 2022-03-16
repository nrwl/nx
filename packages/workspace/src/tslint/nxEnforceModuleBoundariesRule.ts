import * as Lint from 'tslint';
import { IOptions } from 'tslint';
import * as ts from 'typescript';
import type {
  NxJsonConfiguration,
  ProjectGraphExternalNode,
} from '@nrwl/devkit';
import { appRootPath } from '@nrwl/devkit';
import {
  DepConstraint,
  findConstraintsFor,
  findProjectUsingImport,
  findSourceProject,
  getSourceFilePath,
  getTargetProjectBasedOnRelativeImport,
  hasBuildExecutor,
  findDependenciesWithTags,
  isAbsoluteImportIntoAnotherProject,
  MappedProjectGraph,
  mapProjectGraphFiles,
  matchImportWithWildcard,
  onlyLoadChildren,
  stringifyTags,
  hasNoneOfTheseTags,
  MappedProjectGraphNode,
  isAngularSecondaryEntrypoint,
} from '../utils/runtime-lint-utils';
import { normalize } from 'path';
import { TargetProjectLocator } from 'nx/src/core/target-project-locator';
import {
  checkCircularPath,
  findFilesInCircularPath,
} from '../utils/graph-utils';
import { isRelativePath } from '../utilities/fileutils';
import { readNxJson, readCachedProjectGraph } from '@nrwl/devkit';

export class Rule extends Lint.Rules.AbstractRule {
  constructor(
    options: IOptions,
    private readonly projectPath?: string,
    private readonly npmScope?: string,
    private readonly projectGraph?: MappedProjectGraph,
    private readonly targetProjectLocator?: TargetProjectLocator,
    private readonly workspaceLayout?: NxJsonConfiguration['workspaceLayout']
  ) {
    super(options);

    if (!projectPath) {
      this.projectPath = normalize(appRootPath);
      if (!(global as any).projectGraph) {
        const nxJson = readNxJson();
        (global as any).npmScope = nxJson.npmScope;
        (global as any).workspaceLayout = nxJson.workspaceLayout;

        /**
         * Because there are a number of ways in which the rule can be invoked (executor vs TSLint CLI vs IDE Plugin),
         * the ProjectGraph may or may not exist by the time the lint rule is invoked for the first time.
         */
        try {
          (global as any).projectGraph = mapProjectGraphFiles(
            readCachedProjectGraph()
          );
        } catch {}
      }
      this.npmScope = (global as any).npmScope;
      this.workspaceLayout = (global as any).workspaceLayout;
      this.projectGraph = (global as any).projectGraph as MappedProjectGraph;

      if (!(global as any).targetProjectLocator && this.projectGraph) {
        (global as any).targetProjectLocator = new TargetProjectLocator(
          this.projectGraph.nodes,
          this.projectGraph.externalNodes
        );
      }
      this.targetProjectLocator = (global as any).targetProjectLocator;
    }
  }

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    if (!this.projectGraph) return [];
    return this.applyWithWalker(
      new EnforceModuleBoundariesWalker(
        sourceFile,
        this.getOptions(),
        this.projectPath,
        this.npmScope,
        this.projectGraph,
        this.targetProjectLocator,
        this.workspaceLayout
      )
    );
  }
}

class EnforceModuleBoundariesWalker extends Lint.RuleWalker {
  private readonly allow: string[];
  private readonly enforceBuildableLibDependency: boolean = false; // for backwards compat
  private readonly depConstraints: DepConstraint[];
  private readonly allowCircularSelfDependency: boolean = false;

  constructor(
    sourceFile: ts.SourceFile,
    options: IOptions,
    private readonly projectPath: string,
    private readonly npmScope: string,
    private readonly projectGraph: MappedProjectGraph,
    private readonly targetProjectLocator: TargetProjectLocator,
    private readonly workspaceLayout: NxJsonConfiguration['workspaceLayout']
  ) {
    super(sourceFile, options);

    this.allow = Array.isArray(this.getOptions()[0].allow)
      ? this.getOptions()[0].allow.map((a) => `${a}`)
      : [];

    this.depConstraints = Array.isArray(this.getOptions()[0].depConstraints)
      ? this.getOptions()[0].depConstraints
      : [];

    this.enforceBuildableLibDependency =
      this.getOptions()[0].enforceBuildableLibDependency === true;

    this.allowCircularSelfDependency =
      this.getOptions()[0].allowCircularSelfDependency === true;
  }

  public visitImportDeclaration(node: ts.ImportDeclaration) {
    const imp = node.moduleSpecifier
      .getText()
      .substring(1, node.moduleSpecifier.getText().length - 1);

    // whitelisted import
    if (this.allow.some((a) => matchImportWithWildcard(a, imp))) {
      super.visitImportDeclaration(node);
      return;
    }

    const filePath = getSourceFilePath(
      this.getSourceFile().fileName,
      this.projectPath
    );
    const sourceProject = findSourceProject(this.projectGraph, filePath);
    if (!sourceProject) {
      super.visitImportDeclaration(node);
      return;
    }
    let targetProject: MappedProjectGraphNode | ProjectGraphExternalNode =
      getTargetProjectBasedOnRelativeImport(
        imp,
        this.projectPath,
        this.projectGraph,
        filePath
      );

    // check for relative and absolute imports
    if (
      (targetProject && sourceProject !== targetProject) ||
      isAbsoluteImportIntoAnotherProject(imp, this.workspaceLayout)
    ) {
      this.addFailureAt(
        node.getStart(),
        node.getWidth(),
        `libraries cannot be imported by a relative or absolute path, and must begin with a npm scope`
      );
      return;
    }

    targetProject =
      targetProject ||
      findProjectUsingImport(
        this.projectGraph,
        this.targetProjectLocator,
        filePath,
        imp,
        this.npmScope
      );

    // If source or target are not part of an nx workspace, return.
    if (!targetProject || targetProject.type === 'npm') {
      super.visitImportDeclaration(node);
      return;
    }

    // same project => allow
    if (sourceProject === targetProject) {
      if (
        !this.allowCircularSelfDependency &&
        !isRelativePath(imp) &&
        !isAngularSecondaryEntrypoint(this.targetProjectLocator, imp)
      ) {
        const error = `Projects should use relative imports to import from other files within the same project. Use "./path/to/file" instead of import from "${imp}"`;
        this.addFailureAt(node.getStart(), node.getWidth(), error);
      } else {
        super.visitImportDeclaration(node);
      }
      return;
    }

    // check for circular dependency
    const circularPath = checkCircularPath(
      this.projectGraph,
      sourceProject,
      targetProject
    );
    if (circularPath.length !== 0) {
      const path = circularPath.reduce(
        (acc, v) => `${acc} -> ${v.name}`,
        sourceProject.name
      );

      const circularFilePath = findFilesInCircularPath(circularPath);
      const filePaths = circularFilePath
        .map((files) => (files.length > 1 ? `[${files.join(',')}]` : files[0]))
        .reduce((acc, files) => `${acc}\n- ${files}`, `- ${filePath}`);

      const error = `Circular dependency between "${sourceProject.name}" and "${targetProject.name}" detected: ${path}\n\nCircular file chain:\n${filePaths}`;
      this.addFailureAt(node.getStart(), node.getWidth(), error);
      return;
    }

    // cannot import apps
    if (targetProject.type === 'app') {
      this.addFailureAt(
        node.getStart(),
        node.getWidth(),
        'imports of apps are forbidden'
      );
      return;
    }

    // cannot import e2e projects
    if (targetProject.type === 'e2e') {
      this.addFailureAt(
        node.getStart(),
        node.getWidth(),
        'imports of e2e projects are forbidden'
      );
      return;
    }

    // buildable-lib is not allowed to import non-buildable-lib
    if (
      this.enforceBuildableLibDependency === true &&
      sourceProject.type === 'lib' &&
      targetProject.type === 'lib'
    ) {
      if (hasBuildExecutor(sourceProject) && !hasBuildExecutor(targetProject)) {
        this.addFailureAt(
          node.getStart(),
          node.getWidth(),
          'buildable libraries cannot import non-buildable libraries'
        );
        return;
      }
    }

    // if we import a library using loadChildren, we should not import it using es6imports
    if (
      onlyLoadChildren(
        this.projectGraph,
        sourceProject.name,
        targetProject.name,
        []
      )
    ) {
      this.addFailureAt(
        node.getStart(),
        node.getWidth(),
        'imports of lazy-loaded libraries are forbidden'
      );
      return;
    }

    // check that dependency constraints are satisfied
    if (this.depConstraints.length > 0) {
      const constraints = findConstraintsFor(
        this.depConstraints,
        sourceProject
      );
      // when no constrains found => error. Force the user to provision them.
      if (constraints.length === 0) {
        this.addFailureAt(
          node.getStart(),
          node.getWidth(),
          `A project without tags matching at least one constraint cannot depend on any libraries`
        );
        return;
      }

      for (let constraint of constraints) {
        if (
          constraint.onlyDependOnLibsWithTags &&
          hasNoneOfTheseTags(targetProject, constraint.onlyDependOnLibsWithTags)
        ) {
          const error = `A project tagged with "${
            constraint.sourceTag
          }" can only depend on libs tagged with ${stringifyTags(
            constraint.onlyDependOnLibsWithTags
          )}`;
          this.addFailureAt(node.getStart(), node.getWidth(), error);
          return;
        }
        if (
          constraint.notDependOnLibsWithTags &&
          constraint.notDependOnLibsWithTags.length
        ) {
          const projectPaths = findDependenciesWithTags(
            targetProject,
            constraint.notDependOnLibsWithTags,
            this.projectGraph
          );
          if (projectPaths.length > 0) {
            const error = `A project tagged with "${
              constraint.sourceTag
            }" can not depend on libs tagged with ${stringifyTags(
              constraint.notDependOnLibsWithTags
            )}\n\nViolation detected in:\n${projectPaths
              .map(
                (projectPath) =>
                  `- ${projectPath.map((p) => p.name).join(' -> ')}`
              )
              .join('\n')}`;
            this.addFailureAt(node.getStart(), node.getWidth(), error);
            return;
          }
        }
      }
    }

    super.visitImportDeclaration(node);
  }
}
