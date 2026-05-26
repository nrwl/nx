import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { CreateDependenciesContext } from '@nx/devkit';
import type { NormalizedOptions } from '../narrowing-options';
import type { RawDependency, TargetMatchData } from '../types';
import { ExportGraphResolver } from './export-graph-resolver';
import { FileCache } from './file-cache';
import { ImportUsageAnalyzer } from './import-usage-analyzer';
import { TaskRunner } from './task-runner';

const execFileAsync = promisify(execFile);

export class AffectedDependencyAnalyzer {
  constructor(
    private readonly workspaceRoot: string,
    private readonly cache: FileCache,
    private readonly importUsageAnalyzer: ImportUsageAnalyzer,
    private readonly exportGraphResolver: ExportGraphResolver,
    private readonly taskRunner: TaskRunner
  ) {}

  async applyAffectedNarrowing(
    keptEdges: RawDependency[],
    context: CreateDependenciesContext,
    targetMatchMap: Map<string, TargetMatchData>,
    options: NormalizedOptions
  ): Promise<RawDependency[]> {
    const base = process.env['NX_BASE'];
    if (!base) {
      return keptEdges;
    }

    const head = process.env['NX_HEAD'] ?? '';
    const changedFiles = await this.getGitDiffFiles(base, head);
    if (changedFiles.length === 0) {
      return keptEdges;
    }

    const touchedProjects = this.mapFilesToProjects(changedFiles, context.projects);
    if (touchedProjects.size === 0) {
      return keptEdges;
    }

    const changedFilesByProject = new Map<string, Set<string>>();
    for (const [projectName, projectFiles] of touchedProjects) {
      changedFilesByProject.set(projectName, new Set(projectFiles));
    }

    const importedNamesCache = new Map<string, Promise<Set<string>>>();
    const originMapEntries = await this.taskRunner.map(
      [...touchedProjects.keys()],
      async (projectName) => {
        const targetMatch = targetMatchMap.get(projectName);
        if (!targetMatch) {
          return;
        }

        const entryPath = await this.exportGraphResolver.findEntryPoint(
          targetMatch.root
        );
        if (!entryPath) {
          return;
        }

        const originMap = await this.exportGraphResolver.resolveExportOriginsFromFile(
          entryPath,
          new Set<string>()
        );
        if (originMap.size === 0) {
          return;
        }

        return { projectName, originMap } as const;
      }
    );

    const exportOriginMaps = new Map<string, Map<string, Set<string>>>();
    for (const entry of originMapEntries) {
      if (entry) {
        exportOriginMaps.set(entry.projectName, entry.originMap);
      }
    }

    const edgesToCheck: RawDependency[] = [];
    const unconditionallyKept: RawDependency[] = [];

    for (const edge of keptEdges) {
      if (edge.type === 'static' && touchedProjects.has(edge.target)) {
        edgesToCheck.push(edge);
      } else {
        unconditionallyKept.push(edge);
      }
    }

    const decisions = await this.taskRunner.map(edgesToCheck, async (edge) => {
      const changedFilesInTarget = changedFilesByProject.get(edge.target);
      if (!changedFilesInTarget || changedFilesInTarget.size === 0) {
        return { edge, keep: true };
      }

      const targetMatch = targetMatchMap.get(edge.target);
      if (!targetMatch || !edge.sourceFile) {
        return { edge, keep: true };
      }

      const sourceFilePath = join(this.workspaceRoot, edge.sourceFile);
      if (!(await this.cache.exists(sourceFilePath))) {
        return { edge, keep: true };
      }

      const importedNames = await this.importUsageAnalyzer.getImportedNamesForEdgeSourceTarget(
        sourceFilePath,
        targetMatch,
        options.resolveNamespaceImports,
        importedNamesCache
      );

      if (importedNames.has('*') || importedNames.size === 0) {
        return { edge, keep: true };
      }

      const exportOriginMap = exportOriginMaps.get(edge.target);
      if (!exportOriginMap) {
        return { edge, keep: true };
      }

      for (const symbolName of importedNames) {
        const originFiles = exportOriginMap.get(symbolName);
        if (!originFiles) {
          return { edge, keep: true };
        }

        for (const originFile of originFiles) {
          if (changedFilesInTarget.has(originFile)) {
            return { edge, keep: true };
          }
        }
      }

      return { edge, keep: false };
    });

    const result = [...unconditionallyKept];
    for (const decision of decisions) {
      if (decision.keep) {
        result.push(decision.edge);
      }
    }

    return result;
  }

  private async getGitDiffFiles(base: string, head: string): Promise<string[]> {
    try {
      const resolvedBase = head ? await this.resolveMergeBase(base, head) : base;
      const args = ['diff', '--name-only', '--no-renames', '--relative', resolvedBase];
      if (head) {
        args.push(head);
      }

      const { stdout } = await execFileAsync('git', args, {
        cwd: this.workspaceRoot,
        maxBuffer: 10 * 1024 * 1024,
      });

      return stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);
    } catch {
      return [];
    }
  }

  private mapFilesToProjects(
    changedFiles: string[],
    projects: CreateDependenciesContext['projects']
  ): Map<string, string[]> {
    const result = new Map<string, string[]>();
    const sortedProjects = Object.entries(projects).sort(
      ([, left], [, right]) => right.root.length - left.root.length
    );

    for (const file of changedFiles) {
      const normalized = file.split('\\').join('/');
      for (const [projectName, project] of sortedProjects) {
        const root = project.root.split('\\').join('/');
        if (normalized.startsWith(root + '/') || normalized === root) {
          const existing = result.get(projectName);
          if (existing) {
            existing.push(normalized);
          } else {
            result.set(projectName, [normalized]);
          }
          break;
        }
      }
    }

    return result;
  }

  private async resolveMergeBase(base: string, head: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['merge-base', '--fork-point', base, head],
        {
          cwd: this.workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      return stdout.trim() || base;
    } catch {
      return base;
    }
  }
}