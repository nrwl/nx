import * as stripJsonComments from 'strip-json-comments';
import { createDepGraph } from '../dep-graph/create-dep-graph';
import { AffectedMetadata } from './affected-metadata';
import {
  AffectedContext,
  AffectedFilesHandler,
  MutableAffectedSharedState
} from './affected-files-handler';
import { InterProjectDependencyHandler } from './inter-project-dependency-handler';
import { NodeModuleDependencyHandler } from './node-module-dependency-handler';
import { ImplicitJsonDependencyHandler } from './implicit-json-dependency-handler';

export class AffectedMetadataBuilder implements AffectedFilesHandler {
  private readonly handlers: AffectedFilesHandler[];
  private readonly state: MutableAffectedSharedState;
  private ctx: AffectedContext;

  constructor() {
    this.state = {
      dependencyGraph: null,
      projectStates: {},
      markTouched: (p: string) => {
        this.state.projectStates[p].touched = true;
      },
      markAffected: (p: string) => this.markAffected(p)
    };
    this.handlers = [
      new InterProjectDependencyHandler(this.state),
      new ImplicitJsonDependencyHandler(this.state),
      new NodeModuleDependencyHandler(this.state)
    ];
  }

  contextReady(
    ctx: Pick<
      AffectedContext,
      Exclude<keyof AffectedContext, 'readJsonAtRevision'>
    >
  ) {
    this.ctx = {
      ...ctx,
      readJsonAtRevision: (f, r) => {
        try {
          return JSON.parse(stripJsonComments(ctx.readFileAtRevision(f, r)));
        } catch {
          return {};
        }
      }
    };
    this.state.dependencyGraph = createDepGraph(
      ctx.dependencies,
      ctx.projectNodes
    );
    this.ctx.projectNodes.forEach(project => {
      this.state.projectStates[project.name] = {
        touched: false,
        affected: false
      };
    });
    this.handlers.forEach(h => h.contextReady(this.ctx));
  }

  filesTouched(files: string[]) {
    this.handlers.forEach(h => h.filesTouched(files));
  }

  build(): AffectedMetadata {
    return {
      dependencyGraph: this.state.dependencyGraph,
      projectStates: this.state.projectStates
    };
  }

  private markAffected(projectName: string) {
    if (!this.state.projectStates[projectName]) {
      return;
    }
    this.state.projectStates[projectName].affected = true;
    const reverseDependencies =
      this.state.dependencyGraph.reverseDependencies[projectName] || [];
    reverseDependencies.forEach(p => {
      // If a dependency is already marked as affected, it means it has been visited
      if (
        !this.state.projectStates[p] ||
        this.state.projectStates[p].affected
      ) {
        return;
      }
      this.markAffected(p);
    });

    if (this.ctx.withDeps) {
      this.setDeps(projectName);
    }
  }

  private setDeps(projectName: string) {
    if (!this.state.projectStates[projectName]) {
      return;
    }
    this.state.projectStates[projectName].affected = true;
    this.state.dependencyGraph.dependencies[projectName].forEach(dep => {
      // If a dependency is already marked as affected, it means it has been visited
      if (
        !this.state.projectStates[dep.projectName] ||
        this.state.projectStates[dep.projectName].affected
      ) {
        return;
      }
      this.setDeps(dep.projectName);
    });
  }
}
