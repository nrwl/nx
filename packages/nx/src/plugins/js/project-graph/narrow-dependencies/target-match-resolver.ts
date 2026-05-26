import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CreateDependenciesContext } from '@nx/devkit';
import type { NormalizedOptions } from '../narrowing-options';
import type { TargetMatchData } from '../types';

export class TargetMatchResolver {
  constructor(private readonly workspaceRoot: string) {}

  async buildTargetMatchMap(
    context: CreateDependenciesContext,
    options: NormalizedOptions
  ): Promise<Map<string, TargetMatchData>> {
    const tsConfigPaths = await this.readTsConfigPaths();

    const entries = await Promise.all(
      Object.entries(context.projects).map(async ([projectName, project]) => {
        const normalizedRoot = project.root.split('\\').join('/');
        const [packageName, sideEffects] = await Promise.all([
          this.readPackageName(project.root),
          this.readSideEffects(
            project.root,
            options.respectSideEffects,
            options.treatMissingPackageJsonAsSideEffectFree
          ),
        ]);

        return [
          projectName,
          {
            target: projectName,
            root: normalizedRoot,
            packageName,
            aliases: this.aliasesForProject(tsConfigPaths, normalizedRoot),
            sideEffects,
          },
        ] as [string, TargetMatchData];
      })
    );

    return new Map(entries);
  }

  private async readTsConfigPaths(): Promise<Record<string, string[]>> {
    const tsConfigPath = join(this.workspaceRoot, 'tsconfig.base.json');

    try {
      const content = await readFile(tsConfigPath, 'utf8');
      const parsed = JSON.parse(content) as {
        compilerOptions?: { paths?: Record<string, string[]> };
      };

      return parsed.compilerOptions?.paths ?? {};
    } catch {
      return {};
    }
  }

  private async readPackageName(
    projectRoot: string
  ): Promise<string | undefined> {
    const packageJsonPath = join(this.workspaceRoot, projectRoot, 'package.json');

    try {
      const content = await readFile(packageJsonPath, 'utf8');
      const parsed = JSON.parse(content) as { name?: string };
      return parsed.name;
    } catch {
      return undefined;
    }
  }

  private async readSideEffects(
    projectRoot: string,
    respectSideEffects: boolean,
    treatMissingPackageJsonAsSideEffectFree: boolean
  ): Promise<boolean> {
    if (!respectSideEffects) {
      return false;
    }

    const packageJsonPath = join(this.workspaceRoot, projectRoot, 'package.json');

    let content: string;
    try {
      content = await readFile(packageJsonPath, 'utf8');
    } catch {
      return !treatMissingPackageJsonAsSideEffectFree;
    }

    try {
      const parsed = JSON.parse(content) as { sideEffects?: boolean | string[] };
      return parsed.sideEffects !== false;
    } catch {
      return true;
    }
  }

  private aliasesForProject(
    tsConfigPaths: Record<string, string[]>,
    projectRoot: string
  ): string[] {
    const aliases: string[] = [];

    for (const [alias, mappedPaths] of Object.entries(tsConfigPaths)) {
      const belongsToProject = mappedPaths
        .map((mappedPath) => mappedPath.split('\\').join('/').replace(/\*$/, ''))
        .some((mappedPath) => mappedPath.startsWith(projectRoot));

      if (belongsToProject) {
        aliases.push(alias.replace(/\*$/, ''));
      }
    }

    return aliases;
  }
}