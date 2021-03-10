import * as Lint from 'tslint';
import { IOptions } from 'tslint';
import * as ts from 'typescript';
import {
  createProjectGraph,
  isNpmProject,
  ProjectGraph,
  ProjectType,
} from '../core/project-graph';
import { appRootPath } from '../utilities/app-root';
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
} from '../utils/runtime-lint-utils';
import { normalize } from 'path';
import {
  readNxJson,
  readWorkspaceJson,
} from '@nrwl/workspace/src/core/file-utils';
import { TargetProjectLocator } from '../core/target-project-locator';
import { checkCircularPath } from '@nrwl/workspace/src/utils/graph-utils';

export class Rule extends Lint.Rules.AbstractRule {
  constructor(
    options: IOptions,
    private readonly projectPath?: string,
    private readonly npmScope?: string,
    private readonly projectGraph?: ProjectGraph,
    private readonly targetProjectLocator?: TargetProjectLocator
  ) {
    super(options);

    if (!projectPath) {
      this.projectPath = normalize(appRootPath);
      if (!(global as any).projectGraph) {
        const workspaceJson = readWorkspaceJson();
        const nxJson = readNxJson();
        (global as any).npmScope = nxJson.npmScope;
        (global as any).projectGraph = createProjectGraph(
          workspaceJson,
          nxJson
        );
      }
      this.npmScope = (global as any).npmScope;
      this.projectGraph = (global as any).projectGraph;

      if (!(global as any).targetProjectLocator) {
        (global as any).targetProjectLocator = new TargetProjectLocator(
          this.projectGraph.nodes
        );
      }
      this.targetProjectLocator = (global as any).targetProjectLocator;
    }
  }

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(
      new EnforceModuleBoundariesWalker(
        sourceFile,
        this.getOptions(),
        this.projectPath,
        this.npmScope,
        this.projectGraph,
        this.targetProjectLocator
      )
    );
  }
}

class EnforceModuleBoundariesWalker extends Lint.RuleWalker {
  private readonly allow: string[];
  private readonly enforceBuildableLibDependency: boolean = false; // for backwards compat
  private readonly depConstraints: DepConstraint[];

  constructor(
    sourceFile: ts.SourceFile,
    options: IOptions,
    private readonly projectPath: string,
    private readonly npmScope: string,
    private readonly projectGraph: ProjectGraph,
    private readonly targetProjectLocator: TargetProjectLocator
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

    // check for relative and absolute imports
    if (
      isRelativeImportIntoAnotherProject(
        imp,
        this.projectPath,
        this.projectGraph,
        getSourceFilePath(
          normalize(this.getSourceFile().fileName),
          this.projectPath
        )
      ) ||
      isAbsoluteImportIntoAnotherProject(imp)
    ) {
      this.addFailureAt(
        node.getStart(),
        node.getWidth(),
        `libraries cannot be imported by a relative or absolute path, and must begin with a npm scope`
      );
      return;
    }

    const filePath = getSourceFilePath(
      this.getSourceFile().fileName,
      this.projectPath
    );

    const sourceProject = findSourceProject(this.projectGraph, filePath);
    const targetProject = findProjectUsingImport(
      this.projectGraph,
      this.targetProjectLocator,
      filePath,
      imp,
      this.npmScope
    );

    // If source or target are not part of an nx workspace, return.
    if (!sourceProject || !targetProject) {
      super.visitImportDeclaration(node);
      return;
    }

    // same project => allow
    if (sourceProject === targetProject) {
      super.visitImportDeclaration(node);
      return;
    }

    // project => npm package
    if (isNpmProject(targetProject)) {
      super.visitImportDeclaration(node);
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
      const error = `Circular dependency between "${sourceProject.name}" and "${targetProject.name}" detected: ${path}`;
      this.addFailureAt(node.getStart(), node.getWidth(), error);
      return;
    }

    // cannot import apps
    if (targetProject.type === ProjectType.app) {
      this.addFailureAt(
        node.getStart(),
        node.getWidth(),
        'imports of apps are forbidden'
      );
      return;
    }

    // cannot import e2e projects
    if (targetProject.type === ProjectType.e2e) {
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
      sourceProject.type === ProjectType.lib &&
      targetProject.type === ProjectType.lib
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
          `A project without tags cannot depend on any libraries`
        );
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
          const error = `A project tagged with "${constraint.sourceTag}" can only depend on libs tagged with ${allowedTags}`;
          this.addFailureAt(node.getStart(), node.getWidth(), error);
          return;
        }
      }
    }

    super.visitImportDeclaration(node);
  }
}
