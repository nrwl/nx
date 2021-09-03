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
  private globalImplicitDepsHashResult: Promise<ImplicitHashResult>;
  private jsonFilesCache: { [path: string]: any } = {};
  private projectSpecificImplicitDepsHashResults: {
    [project: string]: Promise<ImplicitHashResult>;
  } = {};
  private projectSpecificImplicitDepsCacheKeys: {
    [project: string]: string;
  } = {};

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJsonConfiguration,
    private readonly hashing: HashingImpl
  ) {
    this.parseImplicitDepsSetup();
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
    const hashes: FileHashResult[] = [];

    Object.entries(this.nxJson.implicitDependencies ?? {}).forEach(
      ([filePattern, depConfig]) => {
        const files =
          this.resolveWorkspaceFilesMatchingPattern(filePattern).filter(
            existsSync
          );
        if (typeof depConfig === 'string') {
          if (depConfig === '*') {
            files.forEach((f) =>
              hashes.push({
                file: f,
                hash: this.hashing.hashFile(resolvePathFromRoot(f)),
              })
            );
          }
        } else if (Array.isArray(depConfig)) {
          if (depConfig.includes(project)) {
            files.forEach((f) =>
              hashes.push({
                file: f,
                hash: this.hashing.hashFile(resolvePathFromRoot(f)),
              })
            );
          }
        } else {
          // these are json configs with specific keys config
          files.forEach((f) => {
            const fileJson = this.readJsonFile(
              resolvePathFromRoot(f),
              depConfig
            );
            const matchingFileContent = this.getObjectMatchingDepConfig(
              project,
              depConfig,
              fileJson
            );

            if (matchingFileContent) {
              hashes.push({
                file: f,
                hash: this.hashing.hashArray([
                  JSON.stringify(matchingFileContent),
                ]),
              });
            }
          });
        }
      }
    );

    return hashes;
  }

  private getObjectMatchingDepConfig(
    project: string,
    config: Record<string, any>,
    object: Record<string, any>
  ): Record<string, any> | null {
    const matchingObject: Record<string, any> = {};

    Object.entries(config).forEach(([key, depConfig]) => {
      const keys = this.resolveObjectKeysMatchingPattern(object, key);
      if (typeof depConfig === 'string') {
        if (depConfig === '*') {
          keys.forEach((k) => {
            matchingObject[k] = object[k];
          });
        }
      } else if (Array.isArray(depConfig)) {
        if (depConfig.includes(project)) {
          keys.forEach((k) => {
            matchingObject[k] = object[k];
          });
        }
      } else {
        keys.forEach((k) => {
          const result = this.getObjectMatchingDepConfig(
            project,
            depConfig,
            object[k]
          );
          if (result) {
            matchingObject[k] = result;
          }
        });
      }
    });

    return Object.keys(matchingObject).length > 0 ? matchingObject : null;
  }

  private getCachedProjectImplicitDepsHashResult(
    project: string
  ): Promise<ImplicitHashResult> | null {
    if (
      this.projectSpecificImplicitDepsHashResults[
        this.projectSpecificImplicitDepsCacheKeys[project]
      ]
    ) {
      return this.projectSpecificImplicitDepsHashResults[
        this.projectSpecificImplicitDepsCacheKeys[project]
      ];
    }

    if (
      !this.projectSpecificImplicitDepsCacheKeys[project] &&
      this.globalImplicitDepsHashResult
    ) {
      return this.globalImplicitDepsHashResult;
    }

    return null;
  }

  private cacheImplicitDepsHashResult(
    project: string,
    hashResult: Promise<ImplicitHashResult>
  ): void {
    if (this.projectSpecificImplicitDepsCacheKeys[project]) {
      this.projectSpecificImplicitDepsHashResults[
        this.projectSpecificImplicitDepsCacheKeys[project]
      ] = hashResult;
    } else {
      this.globalImplicitDepsHashResult = hashResult;
    }
  }

  private parseImplicitDepsSetup(
    object: {
      [file: string]: any;
    } = this.nxJson.implicitDependencies ?? {}
  ): void {
    Object.entries(object).forEach(([file, depConfig]) => {
      if (typeof depConfig === 'string') {
        return;
      } else if (Array.isArray(depConfig)) {
        depConfig.forEach((project) => {
          this.addPatternToProjectCacheKey(project, file);
        });
      } else {
        this.addPatternWithSpecificConfigToProjectCacheKey(depConfig, file);
        this.parseDepConfigObjectSetup(depConfig, file);
      }
    });
  }

  private parseDepConfigObjectSetup(
    object: { [key: string]: any },
    file: string
  ) {
    Object.entries(object).forEach(([key, depConfig]) => {
      if (typeof depConfig === 'string') {
        return;
      } else if (Array.isArray(depConfig)) {
        depConfig.forEach((project) => {
          this.addConfigKeyToProjectCacheKey(project, key);
        });
      } else {
        this.parseDepConfigObjectSetup(depConfig, file);
      }
    });
  }

  private addPatternToProjectCacheKey(project: string, pattern: string): void {
    if (this.projectSpecificImplicitDepsCacheKeys[project]) {
      this.projectSpecificImplicitDepsCacheKeys[
        project
      ] = `${this.projectSpecificImplicitDepsCacheKeys[project]}|${pattern}`;
    } else {
      this.projectSpecificImplicitDepsCacheKeys[project] = pattern;
    }
  }

  private addPatternWithSpecificConfigToProjectCacheKey(
    project: string,
    pattern: string
  ): void {
    if (this.projectSpecificImplicitDepsCacheKeys[project]) {
      this.projectSpecificImplicitDepsCacheKeys[
        project
      ] = `${this.projectSpecificImplicitDepsCacheKeys[project]}|${pattern}>`;
    } else {
      this.projectSpecificImplicitDepsCacheKeys[project] = `${pattern}>`;
    }
  }

  private addConfigKeyToProjectCacheKey(project: string, key: string): void {
    this.projectSpecificImplicitDepsCacheKeys[project] = `${key},`;
  }

  private readJsonFile(
    file: string,
    implicitDepConfig: Record<string, any>
  ): any {
    const relativePath = file.startsWith(appRootPath)
      ? file.substr(appRootPath.length + 1)
      : file;
    if (this.jsonFilesCache[relativePath]) {
      return this.jsonFilesCache[relativePath];
    }

    this.jsonFilesCache[relativePath] = this.stripNonDepKeysFromObject(
      readJsonFile(file),
      implicitDepConfig
    );

    return this.jsonFilesCache[relativePath];
  }

  private stripNonDepKeysFromObject(
    object: any,
    config: Record<string, any>
  ): any {
    const result: any = {};
    Object.entries(config).forEach(([key, depConfig]) => {
      const keys = this.resolveObjectKeysMatchingPattern(object, key);
      if (typeof depConfig === 'string' || Array.isArray(depConfig)) {
        keys.forEach((k) => {
          result[k] = object[k];
        });
      } else {
        keys.forEach((k) => {
          result[k] = this.stripNonDepKeysFromObject(object[k], config[k]);
        });
      }
    });

    return result;
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
    if (pattern.indexOf('*') === -1) {
      return [pattern];
    }

    return elements.filter((key) => minimatch(key, pattern));
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
}
