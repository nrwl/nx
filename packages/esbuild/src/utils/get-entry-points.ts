import { ExecutorContext, readJsonFile } from '@nrwl/devkit';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'fast-glob';

export interface GetEntryPointsOptions {
  recursive?: boolean;
  initialEntryPoints?: string[];
  onProjectFilesMatched?: (projectName: string, files: string[]) => void;
}

export function getEntryPoints(
  projectName: string,
  context: ExecutorContext,
  options: GetEntryPointsOptions = {}
): string[] {
  const tsconfigCandidates = [
    'tsconfig.app.json',
    'tsconfig.lib.json',
    'tsconfig.json',
    'tsconfig.base.json',
  ];
  const entryPoints = options.initialEntryPoints
    ? new Set(options.initialEntryPoints)
    : new Set<string>();
  const seenProjects = new Set<string>();

  const findEntryPoints = (projectName: string): void => {
    if (seenProjects.has(projectName)) return;
    seenProjects.add(projectName);

    const project = context.projectGraph?.nodes[projectName];
    if (!project) return;

    const tsconfigFileName = tsconfigCandidates.find((f) => {
      try {
        return fs.statSync(path.join(project.data.root, f)).isFile();
      } catch {
        return false;
      }
    });
    // Workspace projects may not be a TS project, so skip reading source files if tsconfig is not found.
    if (tsconfigFileName) {
      const tsconfig = readJsonFile(
        path.join(project.data.root, tsconfigFileName)
      );
      const projectFiles = glob
        .sync(tsconfig.include ?? [], {
          cwd: project.data.root,
          ignore: tsconfig.exclude ?? [],
        })
        .map((f) => path.join(project.data.root, f));

      projectFiles.forEach((f) => entryPoints.add(f));
      options?.onProjectFilesMatched?.(projectName, projectFiles);
    }

    if (options.recursive) {
      const deps = context.projectGraph.dependencies[projectName];
      deps.forEach((dep) => {
        if (context.projectGraph.nodes[dep.target]) {
          findEntryPoints(dep.target);
        }
      });
    }
  };

  findEntryPoints(projectName);

  return Array.from(entryPoints);
}
