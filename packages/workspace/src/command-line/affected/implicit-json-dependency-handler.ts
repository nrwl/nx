import * as stripJsonComments from 'strip-json-comments';
import {
  AffectedContext,
  AffectedFilesHandler,
  MutableAffectedSharedState
} from './affected-files-handler';
import { deepJsonDiff, JsonValueDiff } from '../json-diff';

export class ImplicitJsonDependencyHandler implements AffectedFilesHandler {
  private ctx: AffectedContext;

  constructor(private readonly state: MutableAffectedSharedState) {}

  contextReady(ctx: AffectedContext): void {
    this.ctx = ctx;
  }

  filesTouched(files: string[]) {
    const {
      nxJson: { implicitDependencies }
    } = this.ctx;

    if (!implicitDependencies) {
      return;
    }

    const changes = Object.entries(implicitDependencies)
      .filter(entry => entry[0].endsWith('.json'))
      .reduce(
        (acc, [fileName, implicitDependencyConfig]) => {
          try {
            acc.push({
              fileName,
              implicitDependencyConfig,
              diff: deepJsonDiff(
                this.ctx.readJsonAtRevision(
                  fileName,
                  this.ctx.revisionRange.head
                ),
                this.ctx.readJsonAtRevision(
                  fileName,
                  this.ctx.revisionRange.base
                )
              )
            });
          } catch {
            // Continue with next file
          }
          return acc;
        },
        [] as Array<{
          fileName: string;
          implicitDependencyConfig: any;
          diff: JsonValueDiff[];
        }>
      );

    changes.forEach(changesByFile => {
      changesByFile.diff.forEach(d => {
        const projects =
          this.getAffectedProjects(
            d.path,
            changesByFile.implicitDependencyConfig
          ) || [];
        if (projects === '*') {
          this.ctx.projectNodes.forEach(p => this.state.markAffected(p.name));
        } else if (Array.isArray(projects)) {
          projects.forEach(p => this.state.markAffected(p));
        }
      });
    });
  }

  private getAffectedProjects(path: string[], implicitDependencyConfig: any) {
    let curr = implicitDependencyConfig;
    for (const key of path) {
      if (curr[key]) {
        curr = curr[key];
      } else {
        break;
      }
    }
    return curr;
  }
}
