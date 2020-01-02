import * as Lint from 'tslint';
import { IOptions } from 'tslint';
import * as ts from 'typescript';
import {
  createProjectGraph,
  ProjectGraph,
  ProjectGraphNode
} from '../core/project-graph';
import { appRootPath } from '../utils/app-root';
import {
  DepConstraint,
  Deps,
  findConstraintsFor,
  findProjectUsingImport,
  findSourceProject,
  getSourceFilePath,
  hasNoneOfTheseTags,
  isAbsoluteImportIntoAnotherProject,
  isCircular,
  isRelativeImportIntoAnotherProject,
  matchImportWithWildcard,
  onlyLoadChildren
} from '../utils/runtime-lint-utils';
import { normalize } from '@angular-devkit/core';
import { ProjectType } from '../core/project-graph';
import {
  normalizedProjectRoot,
  readNxJson,
  readWorkspaceJson
} from '@nrwl/workspace/src/core/file-utils';

export class Rule extends Lint.Rules.AbstractRule {
  constructor(
    options: IOptions,
    private readonly projectPath?: string,
    private readonly npmScope?: string,
    private readonly projectGraph?: ProjectGraph
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
    }
  }

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(
      new EnforceModuleBoundariesWalker(
        sourceFile,
        this.getOptions(),
        this.projectPath,
        this.npmScope,
        this.projectGraph
      )
    );
  }
}

class EnforceModuleBoundariesWalker extends Lint.RuleWalker {
  private readonly allow: string[];
  private readonly depConstraints: DepConstraint[];

  constructor(
    sourceFile: ts.SourceFile,
    options: IOptions,
    private readonly projectPath: string,
    private readonly npmScope: string,
    private readonly projectGraph: ProjectGraph
  ) {
    super(sourceFile, options);

    this.allow = Array.isArray(this.getOptions()[0].allow)
      ? this.getOptions()[0].allow.map(a => `${a}`)
      : [];

    this.depConstraints = Array.isArray(this.getOptions()[0].depConstraints)
      ? this.getOptions()[0].depConstraints
      : [];
  }

  public visitImportDeclaration(node: ts.ImportDeclaration) {
    const imp = node.moduleSpecifier
      .getText()
      .substring(1, node.moduleSpecifier.getText().length - 1);

    // whitelisted import
    if (this.allow.some(a => matchImportWithWildcard(a, imp))) {
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
        `library imports must start with @${this.npmScope}/`
      );
      return;
    }

    // check constraints between libs and apps
    if (imp.startsWith(`@${this.npmScope}/`)) {
      // we should find the name
      const sourceProject = findSourceProject(
        this.projectGraph,
        getSourceFilePath(this.getSourceFile().fileName, this.projectPath)
      );
      // findProjectUsingImport to take care of same prefix
      const targetProject = findProjectUsingImport(
        this.projectGraph,
        this.npmScope,
        imp
      );

      // something went wrong => return.
      if (!sourceProject || !targetProject) {
        super.visitImportDeclaration(node);
        return;
      }

      // check for circular dependency
      if (isCircular(this.projectGraph, sourceProject, targetProject)) {
        const error = `Circular dependency between "${sourceProject.name}" and "${targetProject.name}" detected`;
        this.addFailureAt(node.getStart(), node.getWidth(), error);
        return;
      }

      // same project => allow
      if (sourceProject === targetProject) {
        super.visitImportDeclaration(node);
        return;
      }

      // cannot import apps
      if (targetProject.type !== ProjectType.lib) {
        this.addFailureAt(
          node.getStart(),
          node.getWidth(),
          'imports of apps are forbidden'
        );
        return;
      }

      // deep imports aren't allowed
      if (imp !== `@${this.npmScope}/${normalizedProjectRoot(targetProject)}`) {
        this.addFailureAt(
          node.getStart(),
          node.getWidth(),
          'deep imports into libraries are forbidden'
        );
        return;
      }

      // if we import a library using loadChildre, we should not import it using es6imports
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
              .map(s => `"${s}"`)
              .join(', ');
            const error = `A project tagged with "${constraint.sourceTag}" can only depend on libs tagged with ${allowedTags}`;
            this.addFailureAt(node.getStart(), node.getWidth(), error);
            return;
          }
        }
      }
    }

    super.visitImportDeclaration(node);
  }
}
