import { getImplicitDependencies } from '../shared-utils';
import { touchedProjects } from '../touched';
import {
  AffectedContext,
  AffectedFilesHandler,
  MutableAffectedSharedState
} from './affected-files-handler';

export class InterProjectDependencyHandler implements AffectedFilesHandler {
  private ctx: AffectedContext;

  constructor(private readonly state: MutableAffectedSharedState) {}

  contextReady(ctx: AffectedContext): void {
    this.ctx = ctx;
  }

  filesTouched(files: string[]) {
    const implicitDeps = getImplicitDependencies(
      this.ctx.projectNodes,
      this.ctx.workspaceJson,
      this.ctx.nxJson
    );
    const projectNames = touchedProjects(
      implicitDeps,
      this.ctx.projectNodes,
      files
    );
    projectNames.forEach(projectName => {
      this.state.markTouched(projectName);
      this.state.markAffected(projectName);
    });
  }
}
