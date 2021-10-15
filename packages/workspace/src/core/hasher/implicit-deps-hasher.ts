import {
  NxJsonConfiguration,
  parseJson,
  ProjectGraph,
  readJsonFile,
} from '@nrwl/devkit';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { existsSync, readFileSync } from 'fs';
import * as minimatch from 'minimatch';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { resolvePathFromRoot } from '../../utilities/fileutils';
import { HashingImpl } from './hashing-impl';

export interface ImplicitHashResult {
  value: string;
  files: { [fileName: string]: string };
}

interface FileHashResult {
  file: string;
  hash: string;
}

export class ImplicitDepsHasher {
  private fileHashResults: { [fileWithPaths: string]: FileHashResult } = {};
  private globalImplicitDepsHashResult: Promise<ImplicitHashResult>;
  private implicitDependencies: ImplicitDependencies;
  private jsonFilesCache: { [path: string]: any } = {};
  private projectSpecificImplicitDepsHashResults: {
    [project: string]: Promise<ImplicitHashResult>;
  } = {};

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJsonConfiguration,
    private readonly hashing: HashingImpl
  ) {
    this.implicitDependencies = new ImplicitDependencies(this.nxJson);
  }

  async hashImplicitDeps(project: string): Promise<ImplicitHashResult> {
    const cached = this.getCachedProjectImplicitDepsHashResult(project);
    if (cached) {
      return cached;
    }

    performance.mark('hasher:implicit deps hash:start');

    const hashResult: Promise<ImplicitHashResult> = new Promise((res) => {
      const fileNames = [
        //TODO: vsavkin move the special cases into explicit ts support
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',

        // ignore files will change the set of inputs to the hasher
        '.gitignore',
        '.nxignore',
      ];

      const fileHashes: FileHashResult[] = [
        ...this.getProjectImplicitDepsHashes(project),
        ...fileNames
          .map((file) => {
            const filePath = resolvePathFromRoot(file);
            if (!existsSync(filePath)) {
              return null;
            }

            // we should use default file hasher here
            const hash = this.hashing.hashFile(filePath);
            return { file, hash };
          })
          .filter(Boolean),
        ...this.hashNxJson(),
      ];
      const combinedHash = this.hashing.hashArray(
        fileHashes.map((v) => v.hash)
      );

      performance.mark('hasher:implicit deps hash:end');
      performance.measure(
        'hasher:implicit deps hash',
        'hasher:implicit deps hash:start',
        'hasher:implicit deps hash:end'
      );

      res({
        value: combinedHash,
        files: fileHashes.reduce((m, c) => ((m[c.file] = c.hash), m), {}),
      });
    });

    this.cacheImplicitDepsHashResult(project, hashResult);

    return hashResult;
  }

  private getProjectImplicitDepsHashes(project: string): FileHashResult[] {
    const implicitDepsConfig =
      this.implicitDependencies.getProjectImplicitDepsConfig(project);
    const hashes: FileHashResult[] = Object.entries(implicitDepsConfig).flatMap(
      ([filePattern, paths]) => {
        const files =
          this.resolveWorkspaceFilesMatchingPattern(filePattern).filter(
            existsSync
          );
        return files
          .map((file) => this.getFileHashResult(file, paths))
          .filter(Boolean);
      }
    );

    return hashes;
  }

  private hashNxJson() {
    const nxJsonPath = join(appRootPath, 'nx.json');
    if (!existsSync(nxJsonPath)) {
      return [];
    }

    let nxJsonContents = '{}';
    try {
      const fileContents = readFileSync(nxJsonPath, 'utf-8');
      const r = parseJson(fileContents);
      delete r.projects;
      nxJsonContents = JSON.stringify(r);
    } catch {}

    return [
      {
        hash: this.hashing.hashArray([nxJsonContents]),
        file: 'nx.json',
      },
    ];
  }

  private getFileHashResult(
    file: string,
    paths: string[]
  ): FileHashResult | null {
    const fileKey = `${file}|${paths.join('|')}`;
    if (this.fileHashResults[fileKey]) {
      return this.fileHashResults[fileKey];
    }

    if (paths.length === 0) {
      const hash = this.hashing.hashFile(resolvePathFromRoot(file));
      if (!hash) {
        return null;
      }

      this.fileHashResults[fileKey] = { file, hash };
    } else {
      const fileJson = this.readJsonFile(resolvePathFromRoot(file));
      if (!fileJson) {
        return null;
      }

      const matchingFileContent = this.parseObjectPaths(fileJson, paths);
      this.fileHashResults[fileKey] = {
        file: file,
        hash: this.hashing.hashArray([JSON.stringify(matchingFileContent)]),
      };
    }

    return this.fileHashResults[fileKey];
  }

  private parseObjectPaths(
    sourceObject: Record<string, any>,
    paths: string[]
  ): Record<string, any> {
    let result: Record<string, any> = {};

    paths.forEach((path) => {
      const segments = path.split('|');
      result = {
        ...result,
        ...this.parseObjectSegments(sourceObject, segments, result),
      };
    });

    return result;
  }

  private parseObjectSegments(
    sourceObject: Record<string, any>,
    segments: string[],
    result: Record<string, any>
  ): Record<string, any> {
    if (!sourceObject) {
      return result;
    }
    const segment = segments.shift();
    const keys = this.resolveObjectKeysMatchingPattern(sourceObject, segment);

    if (segments.length === 0) {
      keys
        .filter((key) => sourceObject[key] !== undefined)
        .forEach((key) => {
          result[key] = sourceObject[key];
        });
    } else {
      keys
        .filter((key) => sourceObject[key] !== undefined)
        .forEach((key) => {
          result[key] = {
            ...result[key],
            ...this.parseObjectSegments(
              sourceObject[key],
              segments,
              result[key] ?? {}
            ),
          };
        });
    }

    return result;
  }

  private getCachedProjectImplicitDepsHashResult(
    project: string
  ): Promise<ImplicitHashResult> | null {
    if (
      !this.implicitDependencies.projectHasSpecificConfig(project) &&
      this.globalImplicitDepsHashResult
    ) {
      return this.globalImplicitDepsHashResult;
    }

    if (this.projectSpecificImplicitDepsHashResults[project]) {
      return this.projectSpecificImplicitDepsHashResults[project];
    }

    return null;
  }

  private cacheImplicitDepsHashResult(
    project: string,
    hashResult: Promise<ImplicitHashResult>
  ): void {
    if (this.implicitDependencies.projectHasSpecificConfig(project)) {
      this.projectSpecificImplicitDepsHashResults[project] = hashResult;
    } else {
      this.globalImplicitDepsHashResult = hashResult;
    }
  }

  private readJsonFile(file: string): any | undefined {
    const relativePath = file.startsWith(appRootPath)
      ? file.substr(appRootPath.length + 1)
      : file;
    if (this.jsonFilesCache[relativePath]) {
      return this.jsonFilesCache[relativePath];
    }

    try {
      this.jsonFilesCache[relativePath] = readJsonFile(file);
    } catch {}

    return this.jsonFilesCache[relativePath];
  }

  private resolveWorkspaceFilesMatchingPattern(pattern: string): string[] {
    const elements = (this.projectGraph.allWorkspaceFiles ?? []).map(
      (f) => f.file
    );

    return this.resolveElementsMatchingPattern(elements, pattern);
  }

  private resolveObjectKeysMatchingPattern(
    object: { [key: string]: any },
    pattern: string
  ): string[] {
    return this.resolveElementsMatchingPattern(Object.keys(object), pattern);
  }

  private resolveElementsMatchingPattern(
    elements: string[],
    pattern: string
  ): string[] {
    if (pattern.indexOf(this.implicitDependencies.wildcard) === -1) {
      return [pattern];
    }

    return elements.filter((key) => minimatch(key, pattern));
  }
}

type ProjectImplicitDepConfig = { [file: string]: string[] };

class ImplicitDependencies {
  readonly wildcard = '*';

  private parsedImplicitDependencies: {
    [project: string]: ProjectImplicitDepConfig;
  } = {};

  constructor(nxJson: NxJsonConfiguration) {
    this.parseImplicitDepsSetup(nxJson.implicitDependencies ?? {});
  }

  getProjectImplicitDepsConfig(project: string): ProjectImplicitDepConfig {
    return (
      this.parsedImplicitDependencies[project] ??
      this.parsedImplicitDependencies[this.wildcard] ??
      {}
    );
  }

  projectHasSpecificConfig(project: string) {
    return this.parsedImplicitDependencies[project] !== undefined;
  }

  private parseImplicitDepsSetup(implicitDeps: { [file: string]: any }): void {
    Object.entries(implicitDeps).forEach(([file, depConfig]) => {
      if (typeof depConfig === 'string') {
        this.addImplicitFileToProject(this.wildcard, file);
      } else if (Array.isArray(depConfig)) {
        depConfig.forEach((project) => {
          this.addImplicitFileToProject(project, file);
        });
      } else {
        this.parseDepConfigObjectSetup(depConfig, file);
      }
    });

    if (!this.parsedImplicitDependencies[this.wildcard]) {
      return;
    }

    Object.keys(this.parsedImplicitDependencies)
      .filter((project) => project !== this.wildcard)
      .forEach((project) => {
        this.mergeAllProjectsConfigIntoProjectConfig(
          this.parsedImplicitDependencies[project],
          this.parsedImplicitDependencies[this.wildcard]
        );
      });
  }

  private parseDepConfigObjectSetup(
    object: { [key: string]: any },
    file: string,
    paths: string[] = []
  ): void {
    Object.entries(object).forEach(([key, depConfig]) => {
      const currentPaths = [...paths, key];
      if (typeof depConfig === 'string') {
        this.addImplicitFileToProject(
          this.wildcard,
          file,
          currentPaths.join('|')
        );
      } else if (Array.isArray(depConfig)) {
        depConfig.forEach((project) => {
          this.addImplicitFileToProject(project, file, currentPaths.join('|'));
        });
      } else {
        this.parseDepConfigObjectSetup(depConfig, file, currentPaths);
      }
    });
  }

  private addImplicitFileToProject(
    project: string,
    file: string,
    path?: string
  ): void {
    const projectConfig = this.parsedImplicitDependencies[project];
    if (projectConfig) {
      projectConfig[file] = [
        ...(projectConfig[file] ?? []),
        ...(path ? [path] : []),
      ];
    } else {
      this.parsedImplicitDependencies[project] = {
        [file]: path ? [path] : [],
      };
    }
  }

  private mergeAllProjectsConfigIntoProjectConfig(
    projectConfig: ProjectImplicitDepConfig,
    allProjectsDepConfig: ProjectImplicitDepConfig
  ): void {
    Object.keys(allProjectsDepConfig).forEach((file) => {
      projectConfig[file] = [
        ...(projectConfig[file] ?? []),
        ...allProjectsDepConfig[file],
      ];
    });
  }
}
