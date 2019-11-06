import { DependencyType } from '../shared-models';
import {
  AffectedContext,
  AffectedFilesHandler,
  MutableAffectedSharedState
} from './affected-files-handler';
import { deepJsonDiff } from '../json-diff';

export class NodeModuleDependencyHandler implements AffectedFilesHandler {
  private ctx: AffectedContext;

  constructor(private readonly state: MutableAffectedSharedState) {}

  contextReady(ctx: AffectedContext): void {
    this.ctx = ctx;
  }

  filesTouched(files: string[]) {
    if (files.some(f => f === 'package.json')) {
      const packageJsonAtBase = this.ctx.readJsonAtRevision(
        'package.json',
        this.ctx.revisionRange.base
      );
      const packageJsonAtHead = this.ctx.readJsonAtRevision(
        'package.json',
        this.ctx.revisionRange.head
      );
      const diff = deepJsonDiff(packageJsonAtBase, packageJsonAtHead);

      if (diff.length > 0) {
        const projectsByNodeModule: Record<string, string[]> = {};

        Object.keys(this.ctx.dependencies).forEach(projectName => {
          const modules = this.ctx.dependencies[projectName]
            .filter(x => x.type === DependencyType.nodeModule)
            .map(x => x.projectName);
          modules.forEach(m => {
            projectsByNodeModule[m] = projectsByNodeModule[m] || [];
            projectsByNodeModule[m].push(projectName);
          });
        });

        diff.forEach(d => {
          const module = d.path[1]; // path[0] is "dependencies" or "devDependencies"
          if (projectsByNodeModule[module]) {
            projectsByNodeModule[module].forEach(projectName => {
              this.state.markAffected(projectName);
            });
          }
        });
      }
    }
  }
}
