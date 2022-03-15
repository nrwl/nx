import {
  NxJsonConfiguration,
  ProjectGraph,
  readJsonFile,
  Task,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { resolveNewFormatWithInlineProjects } from '@nrwl/tao/src/shared/workspace';
import { exec } from 'child_process';
import { existsSync } from 'fs';
import * as minimatch from 'minimatch';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { getRootTsConfigFileName } from '../../utilities/typescript';
import { appRootPath } from '../../utils/app-root';
import { workspaceFileName } from '../file-utils';
import { defaultHashing, HashingImpl } from './hashing-impl';

export interface Hash {
  value: string;
  details: {
    command: string;
    nodes: { [name: string]: string };
    implicitDeps: { [fileName: string]: string };
    runtime: { [input: string]: string };
  };
}

interface ProjectHashResult {
  value: string;
  nodes: { [name: string]: string };
}

interface ImplicitHashResult {
  value: string;
  files: { [fileName: string]: string };
}

interface RuntimeHashResult {
  value: string;
  runtime: { [input: string]: string };
}

interface CompilerOptions {
  paths: Record<string, string[]>;
}

interface TsconfigJsonConfiguration {
  compilerOptions: CompilerOptions;
}

export const HashFilter = {
  AllFiles: 'all-files',
  ExcludeTestsOfAll: 'exclude-tests-of-all',
  ExcludeTestsOfDeps: 'exclude-tests-of-deps',
} as const;
export type HashFilter = typeof HashFilter[keyof typeof HashFilter];

export const NodeHashFilter = {
  AllFiles: 'all-files',
  ExcludeTests: 'exclude-tests',
} as const;
export type NodeHashFilter = typeof NodeHashFilter[keyof typeof NodeHashFilter];

export class Hasher {
  static version = '2.0';
  private implicitDependencies: Promise<ImplicitHashResult>;
  private runtimeInputs: Promise<RuntimeHashResult>;
  private projectHashes: ProjectHasher;
  private hashing: HashingImpl;

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJsonConfiguration,
    private readonly options: any,
    hashing: HashingImpl = undefined
  ) {
    if (!hashing) {
      this.hashing = defaultHashing;
    } else {
      // this is only used for testing
      this.hashing = hashing;
    }
    this.projectHashes = new ProjectHasher(this.projectGraph, this.hashing, {
      selectivelyHashTsConfig: this.options.selectivelyHashTsConfig ?? false,
    });
  }

  async hashTaskWithDepsAndContext(
    task: Task,
    filter: HashFilter = HashFilter.AllFiles
  ): Promise<Hash> {
    const command = this.hashCommand(task);

    const values = (await Promise.all([
      this.projectHashes.hashProject(
        task.target.project,
        [task.target.project],
        filter
      ),
      this.implicitDepsHash(),
      this.runtimeInputsHash(),
    ])) as [
      ProjectHashResult,
      ImplicitHashResult,
      RuntimeHashResult
      // NodeModulesResult
    ];

    const value = this.hashing.hashArray([
      Hasher.version,
      command,
      ...values.map((v) => v.value),
    ]);

    return {
      value,
      details: {
        command,
        nodes: values[0].nodes,
        implicitDeps: values[1].files,
        runtime: values[2].runtime,
      },
    };
  }

  hashCommand(task: Task) {
    return this.hashing.hashArray([
      task.target.project ?? '',
      task.target.target ?? '',
      task.target.configuration ?? '',
      JSON.stringify(task.overrides),
    ]);
  }

  async hashContext(): Promise<{
    implicitDeps: ImplicitHashResult;
    runtime: RuntimeHashResult;
  }> {
    const values = (await Promise.all([
      this.implicitDepsHash(),
      this.runtimeInputsHash(),
    ])) as [ImplicitHashResult, RuntimeHashResult];

    return {
      implicitDeps: values[0],
      runtime: values[1],
    };
  }

  async hashSource(task: Task): Promise<string> {
    return this.projectHashes.hashProjectNodeSource(
      task.target.project,
      NodeHashFilter.AllFiles
    );
  }

  hashArray(values: string[]): string {
    return this.hashing.hashArray(values);
  }

  private async runtimeInputsHash(): Promise<RuntimeHashResult> {
    if (this.runtimeInputs) return this.runtimeInputs;

    performance.mark('hasher:runtime inputs hash:start');

    this.runtimeInputs = new Promise(async (res, rej) => {
      const inputs =
        this.options && this.options.runtimeCacheInputs
          ? this.options.runtimeCacheInputs
          : [];
      if (inputs.length > 0) {
        try {
          const values = (await Promise.all(
            inputs.map(
              (input) =>
                new Promise((res, rej) => {
                  exec(input, (err, stdout, stderr) => {
                    if (err) {
                      rej(err);
                    } else {
                      res({ input, value: `${stdout}${stderr}`.trim() });
                    }
                  });
                })
            )
          )) as any;

          const value = this.hashing.hashArray(values.map((v) => v.value));
          const runtime = values.reduce(
            (m, c) => ((m[c.input] = c.value), m),
            {}
          );

          performance.mark('hasher:runtime inputs hash:end');
          performance.measure(
            'hasher:runtime inputs hash',
            'hasher:runtime inputs hash:start',
            'hasher:runtime inputs hash:end'
          );
          res({ value, runtime });
        } catch (e) {
          rej(
            new Error(
              `Nx failed to execute runtimeCacheInputs defined in nx.json failed:\n${e.message}`
            )
          );
        }
      } else {
        res({ value: '', runtime: {} });
      }
    });

    return this.runtimeInputs;
  }

  private async implicitDepsHash(): Promise<ImplicitHashResult> {
    if (this.implicitDependencies) return this.implicitDependencies;

    performance.mark('hasher:implicit deps hash:start');

    this.implicitDependencies = new Promise((res) => {
      const implicitDeps = Object.keys(this.nxJson.implicitDependencies ?? {});
      const filesWithoutPatterns = implicitDeps.filter(
        (p) => p.indexOf('*') === -1
      );
      const patterns = implicitDeps.filter((p) => p.indexOf('*') !== -1);

      const implicitDepsFromPatterns =
        patterns.length > 0
          ? (this.projectGraph.allWorkspaceFiles ?? [])
              .filter(
                (f) => !!patterns.find((pattern) => minimatch(f.file, pattern))
              )
              .map((f) => f.file)
          : [];

      const fileNames = [
        ...filesWithoutPatterns,
        ...implicitDepsFromPatterns,

        //TODO: vsavkin move the special cases into explicit ts support
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml',

        // ignore files will change the set of inputs to the hasher
        '.gitignore',
        '.nxignore',
      ];

      const fileHashes = [
        ...fileNames
          .map((maybeRelativePath) => {
            // Normalize the path to always be absolute and starting with appRootPath so we can check it exists
            if (!maybeRelativePath.startsWith(appRootPath)) {
              return join(appRootPath, maybeRelativePath);
            }
            return maybeRelativePath;
          })
          .filter((file) => existsSync(file))
          .map((file) => {
            // we should use default file hasher here
            const hash = this.hashing.hashFile(file);
            return { file, hash };
          }),
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

    return this.implicitDependencies;
  }

  private hashNxJson() {
    const nxJsonPath = join(appRootPath, 'nx.json');
    if (!existsSync(nxJsonPath)) {
      return [];
    }

    let nxJsonContents = '{}';
    try {
      const nxJson = readJsonFile(nxJsonPath);
      delete nxJson.projects;
      nxJsonContents = JSON.stringify(nxJson);
    } catch {}

    return [
      {
        hash: this.hashing.hashArray([nxJsonContents]),
        file: 'nx.json',
      },
    ];
  }
}

class ProjectHasher {
  private sourceHashes: { [projectName: string]: Promise<string> } = {};
  private workspaceJson: WorkspaceJsonConfiguration;
  private nxJson: NxJsonConfiguration;
  private tsConfigJson: TsconfigJsonConfiguration;

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly hashing: HashingImpl,
    private readonly options: { selectivelyHashTsConfig: boolean }
  ) {
    this.workspaceJson = this.readWorkspaceConfigFile(workspaceFileName());
    this.nxJson = this.readNxJsonConfigFile('nx.json');
    this.tsConfigJson = this.readTsConfig();
  }

  async hashProject(
    projectName: string,
    visited: string[],
    filter: HashFilter
  ): Promise<ProjectHashResult> {
    return Promise.resolve().then(async () => {
      const deps = this.projectGraph.dependencies[projectName] ?? [];
      const depHashes = (
        await Promise.all(
          deps.map(async (d) => {
            if (visited.indexOf(d.target) > -1) {
              return null;
            } else {
              visited.push(d.target);
              return await this.hashProject(d.target, visited, filter);
            }
          })
        )
      ).filter((r) => !!r);
      const filterForProject: NodeHashFilter =
        filter === HashFilter.AllFiles ||
        (filter === HashFilter.ExcludeTestsOfDeps && visited[0] === projectName)
          ? NodeHashFilter.AllFiles
          : NodeHashFilter.ExcludeTests;
      const projectHash = await this.hashProjectNodeSource(
        projectName,
        filterForProject
      );
      const nodes = depHashes.reduce(
        (m, c) => {
          return { ...m, ...c.nodes };
        },
        { [projectName]: projectHash }
      );
      const value = this.hashing.hashArray([
        ...depHashes.map((d) => d.value),
        projectHash,
      ]);
      return { value, nodes };
    });
  }

  async hashProjectNodeSource(projectName: string, filter: NodeHashFilter) {
    const mapKey = `${projectName}-${filter}`;
    if (!this.sourceHashes[mapKey]) {
      this.sourceHashes[mapKey] = new Promise(async (res) => {
        const p = this.projectGraph.nodes[projectName];

        if (!p) {
          const n = this.projectGraph.externalNodes[projectName];
          const version = n?.data?.version;
          let hash: string;
          if (version) {
            hash = this.hashing.hashArray([version]);
          } else {
            // unknown dependency
            // this may occur if a file has a dependency to a npm package
            // which is not directly registestered in package.json
            // but only indirectly through dependencies of registered
            // npm packages
            // when it is at a later stage registered in package.json
            // the cache project graph will not know this module but
            // the new project graph will know it
            // The actual checksum added here is of no importance as
            // the version is unknown and may only change when some
            // other change occurs in package.json and/or package-lock.json
            hash = `__${projectName}__`;
          }
          res(hash);
          return;
        }

        const filteredFiles =
          filter === NodeHashFilter.AllFiles
            ? p.data.files
            : p.data.files.filter((f) => !this.isSpec(f.file));

        const fileNames = filteredFiles.map((f) => f.file);
        const values = filteredFiles.map((f) => f.hash);

        const workspaceJson = JSON.stringify(
          this.workspaceJson.projects[projectName] ?? ''
        );

        let tsConfig: string;

        if (this.options.selectivelyHashTsConfig) {
          tsConfig = this.removeOtherProjectsPathRecords(projectName);
        } else {
          tsConfig = JSON.stringify(this.tsConfigJson);
        }

        res(
          this.hashing.hashArray([
            ...fileNames,
            ...values,
            workspaceJson,
            tsConfig,
          ])
        );
      });
    }
    return this.sourceHashes[mapKey];
  }

  private isSpec(file: string) {
    return (
      file.endsWith('.spec.ts') ||
      file.endsWith('.test.ts') ||
      file.endsWith('-test.ts') ||
      file.endsWith('-spec.ts') ||
      file.endsWith('.spec.js') ||
      file.endsWith('.test.js') ||
      file.endsWith('-test.js') ||
      file.endsWith('-spec.js')
    );
  }

  private removeOtherProjectsPathRecords(projectName: string) {
    const { paths, ...compilerOptions } = this.tsConfigJson.compilerOptions;

    const rootPath = this.workspaceJson.projects[projectName].root.split('/');
    rootPath.shift();
    const pathAlias = `@${this.nxJson.npmScope}/${rootPath.join('/')}`;

    return JSON.stringify({
      compilerOptions: {
        ...compilerOptions,
        paths: {
          [pathAlias]: paths[pathAlias] ?? [],
        },
      },
    });
  }

  private readTsConfig() {
    try {
      const res = readJsonFile(getRootTsConfigFileName());
      res.compilerOptions.paths ??= {};
      return res;
    } catch {
      return {
        compilerOptions: { paths: {} },
      };
    }
  }

  private readWorkspaceConfigFile(path: string): WorkspaceJsonConfiguration {
    try {
      const res = readJsonFile(path);
      res.projects ??= {};
      return resolveNewFormatWithInlineProjects(res);
    } catch {
      return { projects: {}, version: 2 };
    }
  }

  private readNxJsonConfigFile(path: string): NxJsonConfiguration {
    try {
      const res = readJsonFile(path);
      res.projects ??= {};
      return res;
    } catch {
      return { npmScope: '' };
    }
  }
}
