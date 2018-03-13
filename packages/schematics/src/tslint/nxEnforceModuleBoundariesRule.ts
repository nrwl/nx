import * as path from 'path';
import * as Lint from 'tslint';
import { IOptions } from 'tslint';
import * as ts from 'typescript';
import { readFileSync } from 'fs';
import * as appRoot from 'app-root-path';
import {getProjectNodes} from '../command-line/shared';
import {dependencies, Dependency, DependencyType, ProjectNode, ProjectType} from '../command-line/affected-apps';

export class Rule extends Lint.Rules.AbstractRule {
  constructor(
    options: IOptions,
    private readonly projectPath?: string,
    private readonly npmScope?: string,
    private readonly projectNodes?: ProjectNode[],
    private readonly deps?: { [projectName: string]: Dependency[] },
  ) {
    super(options);
    if (!projectPath) {
      this.projectPath = appRoot.path;
      const cliConfig = this.readCliConfig(this.projectPath);
      this.npmScope = cliConfig.project.npmScope;
      this.projectNodes = getProjectNodes(cliConfig);
      this.deps = dependencies(this.npmScope, this.projectNodes, f => readFileSync(f).toString());
    }
  }

  public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
    return this.applyWithWalker(
      new EnforceModuleBoundariesWalker(
        sourceFile,
        this.getOptions(),
        this.projectPath,
        this.npmScope,
        this.projectNodes,
        this.deps
      )
    );
  }

  private readCliConfig(projectPath: string): any {
    return JSON.parse(readFileSync(`${projectPath}/.angular-cli.json`, 'UTF-8'));
  }
}

type DepConstraint = {
  sourceTag: string;
  onlyDependOnLibsWithTags: string[];
};

class EnforceModuleBoundariesWalker extends Lint.RuleWalker {
  private readonly allow: string[];
  private readonly depConstraints: DepConstraint[];

  constructor(
    sourceFile: ts.SourceFile,
    options: IOptions,
    private readonly projectPath: string,
    private readonly npmScope: string,
    private readonly projectNodes: ProjectNode[],
    private readonly deps: { [projectName: string]: Dependency[] }
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
    const imp = node.moduleSpecifier.getText().substring(1, node.moduleSpecifier.getText().length - 1);

    // whitelisted import
    if (this.allow.indexOf(imp) > -1) {
      super.visitImportDeclaration(node);
      return;
    }

    // check for relative and absolute imports
    if (this.isRelativeImportIntoAnotherProject(imp) || this.isAbsoluteImportIntoAnotherProject(imp)) {
      this.addFailureAt(node.getStart(), node.getWidth(), `library imports must start with @${this.npmScope}/`);
      return;
    }

    // check constraints between libs and apps
    if (imp.startsWith(`@${this.npmScope}/`)) {
      const name = imp.split('/')[1];
      const sourceProject = this.findSourceProject();
      const targetProject = this.findProjectUsingName(name);

      // something went wrong => return.
      if (!sourceProject || !targetProject) {
        super.visitImportDeclaration(node);
        return;
      }

      // same project => allow
      if (sourceProject === targetProject) {
        super.visitImportDeclaration(node);
        return;
      }

      // cannot import apps
      if (targetProject.type === ProjectType.app) {
        this.addFailureAt(node.getStart(), node.getWidth(), 'imports of apps are forbidden');
        return;
      }

      // deep imports aren't allowed
      if (imp.split('/').length > 2) {
        this.addFailureAt(node.getStart(), node.getWidth(), 'deep imports into libraries are forbidden');
        return;
      }

      // if we import a library using loadChildre, we should not import it using es6imports
      if (this.onlyLoadChildren(sourceProject.name, targetProject.name, [])) {
        this.addFailureAt(node.getStart(), node.getWidth(), 'imports of lazy-loaded libraries are forbidden');
        return;
      }

      // check that dependency constraints are satisfied
      if (this.depConstraints.length > 0) {
        const constraint = this.findConstraintFor(sourceProject);

        // when no constrains found => error. Force the user to provision them.
        if (!constraint) {
          this.addFailureAt(node.getStart(), node.getWidth(), `A project without tags cannot depend on any libraries`);
          return;
        }

        if (hasNoneOfTheseTags(targetProject, constraint.onlyDependOnLibsWithTags || [])) {
          const allowedTags = constraint.onlyDependOnLibsWithTags
            .map(s => `"${s}"`)
            .join(', ');
          const error = `A project tagged with "${constraint.sourceTag}" can only depend on libs tagged with ${allowedTags}`;
          this.addFailureAt(node.getStart(), node.getWidth(), error);
          return;
        }
      }
    }

    super.visitImportDeclaration(node);
  }

  private onlyLoadChildren(sourceProjectName: string, targetProjectName: string, visited: string[]) {
    if (visited.indexOf(sourceProjectName) > -1) return false;
    return (this.deps[sourceProjectName] || []).filter(d => {
      if (d.type !== DependencyType.loadChildren) return false;
      if (d.projectName === targetProjectName) return true;
      return this.onlyLoadChildren(d.projectName, targetProjectName, [...visited, sourceProjectName]);
    }).length > 0;
  }

  private isRelativeImportIntoAnotherProject(imp: string): boolean {
    if (!this.isRelative(imp)) return false;

    const targetFile = path
      .resolve(path.join(this.projectPath, path.dirname(this.getSourceFilePath())), imp)
      .split(path.sep)
      .join('/')
      .substring(this.projectPath.length + 1);

    const sourceProject = this.findSourceProject();
    const targetProject = this.findTargetProject(targetFile);
    return sourceProject && targetProject && sourceProject !== targetProject;
  }

  private getSourceFilePath() {
    return this.getSourceFile().fileName.substring(this.projectPath.length + 1);
  }

  private findSourceProject() {
    const targetFile = removeExt(this.getSourceFilePath());
    return this.findProjectUsingFile(targetFile);
  }

  private findTargetProject(targetFile: string) {
    let targetProject = this.findProjectUsingFile(targetFile);
    if (!targetProject) {
      targetProject = this.findProjectUsingFile(path.join(targetFile, 'index'));
    }
    return targetProject;
  }

  private findProjectUsingFile(file: string) {
    return this.projectNodes.filter(n => containsFile(n.files, file))[0];
  }

  private findProjectUsingName(name: string) {
    return this.projectNodes.filter(n => n.name === name)[0];
  }

  private isAbsoluteImportIntoAnotherProject(imp: string) {
    return imp.startsWith('libs/') || (imp.startsWith('/libs/') && imp.startsWith('apps/')) || imp.startsWith('/apps/');
  }

  private isRelative(s: string) {
    return s.startsWith('.');
  }

  private findConstraintFor(sourceProject: ProjectNode) {
    return this.depConstraints.filter(f => hasTag(sourceProject, f.sourceTag))[0];
  }
}

function hasNoneOfTheseTags(proj: ProjectNode, tags: string[]) {
  return tags.filter(allowedTag => hasTag(proj, allowedTag)).length === 0;
}

function hasTag(proj: ProjectNode, tag: string) {
  return (proj.tags || []).indexOf(tag) > -1 || tag === '*';
}

function containsFile(files: string[], targetFileWithoutExtension: string): boolean {
  return !!files.filter(f => removeExt(f) === targetFileWithoutExtension)[0];
}

function removeExt(file:string): string {
  return file.replace(/\.[^/.]+$/, "");
}