import { exec } from 'child_process';
import * as minimatch from 'minimatch';
import { existsSync } from 'fs';
import { getRootTsConfigFileName } from '../utils/typescript';
import { defaultHashing, HashingImpl } from './hashing-impl';
import {
  FileData,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task } from '../config/task-graph';
import { readJsonFile } from '../utils/fileutils';
import { InputDefinition } from '../config/workspace-json-project-json';
import { getImportPath } from '../utils/path';
import { workspaceRoot } from '../utils/workspace-root';
import { join } from 'path';

type ExpandedSelfInput =
  | { fileset: string }
  | { runtime: string }
  | { env: string };

/**
 * A data structure returned by the default hasher.
 */
export interface PartialHash {
  value: string;
  details: {
    [name: string]: string;
  };
}

/**
 * A data structure returned by the default hasher.
 */
export interface Hash {
  value: string;
  details: {
    command: string;
    nodes: { [name: string]: string };
    implicitDeps?: { [fileName: string]: string };
    runtime?: { [input: string]: string };
  };
}

interface CompilerOptions {
  paths: Record<string, string[]>;
}

interface TsconfigJsonConfiguration {
  compilerOptions: CompilerOptions;
}

/**
 * The default hasher used by executors.
 */
export class Hasher {
  static version = '3.0';
  private taskHasher: TaskHasher;
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

    const legacyRuntimeInputs = (
      this.options && this.options.runtimeCacheInputs
        ? this.options.runtimeCacheInputs
        : []
    ).map((r) => ({ runtime: r }));

    const legacyFilesetInputs = [
      ...Object.keys(this.nxJson.implicitDependencies ?? {}),
      'nx.json',
      //TODO: vsavkin move the special cases into explicit ts support
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',

      // ignore files will change the set of inputs to the hasher
      '.gitignore',
      '.nxignore',
    ].map((d) => ({ fileset: `{workspaceRoot}/${d}` }));

    this.taskHasher = new TaskHasher(
      nxJson,
      legacyRuntimeInputs,
      legacyFilesetInputs,
      this.projectGraph,
      this.readTsConfig(),
      this.hashing,
      { selectivelyHashTsConfig: this.options.selectivelyHashTsConfig ?? false }
    );
  }

  async hashTask(task: Task): Promise<Hash> {
    const res = await this.taskHasher.hashTask(task, [task.target.project]);
    const command = this.hashCommand(task);
    return {
      value: this.hashArray([res.value, command]),
      details: {
        command,
        nodes: res.details,
        implicitDeps: {},
        runtime: {},
      },
    };
  }

  /**
   * @deprecated use hashTask instead
   */
  async hashTaskWithDepsAndContext(task: Task): Promise<Hash> {
    return this.hashTask(task);
  }

  /**
   * @deprecated hashTask will hash runtime inputs and global files
   */
  async hashContext(): Promise<any> {
    return {
      implicitDeps: '',
      runtime: '',
    };
  }

  hashCommand(task: Task): string {
    const overrides = { ...task.overrides };
    delete overrides['__overrides_unparsed__'];
    const sortedOverrides = {};
    for (let k of Object.keys(overrides).sort()) {
      sortedOverrides[k] = overrides[k];
    }

    return this.hashing.hashArray([
      task.target.project ?? '',
      task.target.target ?? '',
      task.target.configuration ?? '',
      JSON.stringify(sortedOverrides),
    ]);
  }

  /**
   * @deprecated use hashTask
   */
  async hashSource(task: Task): Promise<string> {
    const hash = await this.taskHasher.hashTask(task, [task.target.project]);
    return hash.details[`${task.target.project}:$filesets`];
  }

  hashArray(values: string[]): string {
    return this.hashing.hashArray(values);
  }

  hashFile(path: string): string {
    return this.hashing.hashFile(path);
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
}

const DEFAULT_INPUTS = [
  {
    projects: 'self',
    fileset: 'default',
  },
  {
    projects: 'dependencies',
    input: 'default',
  },
];

class TaskHasher {
  private filesetHashes: {
    [taskId: string]: Promise<PartialHash>;
  } = {};
  private runtimeHashes: {
    [runtime: string]: Promise<PartialHash>;
  } = {};

  constructor(
    private readonly nxJson: NxJsonConfiguration,
    private readonly legacyRuntimeInputs: { runtime: string }[],
    private readonly legacyFilesetInputs: { fileset: string }[],
    private readonly projectGraph: ProjectGraph,
    private readonly tsConfigJson: TsconfigJsonConfiguration,
    private readonly hashing: HashingImpl,
    private readonly options: { selectivelyHashTsConfig: boolean }
  ) {}

  async hashTask(task: Task, visited: string[]): Promise<PartialHash> {
    return Promise.resolve().then(async () => {
      const projectNode = this.projectGraph.nodes[task.target.project];
      if (!projectNode) {
        return this.hashExternalDependency(task);
      }
      const projectGraphDeps =
        this.projectGraph.dependencies[task.target.project] ?? [];

      const { selfInputs, depsInputs } = this.inputs(task, projectNode);
      const self = await this.hashSelfInputs(task, selfInputs);
      const deps = await this.hashDepsTasks(
        depsInputs,
        projectGraphDeps,
        visited
      );

      let details = {};
      for (const s of self) {
        details = { ...details, ...s.details };
      }
      for (const s of deps) {
        details = { ...details, ...s.details };
      }

      const value = this.hashing.hashArray([
        ...self.map((d) => d.value),
        ...deps.map((d) => d.value),
      ]);

      return { value, details };
    });
  }

  private async hashDepsTasks(
    inputs: { input: string }[],
    projectGraphDeps: ProjectGraphDependency[],
    visited: string[]
  ): Promise<PartialHash[]> {
    return (
      await Promise.all(
        inputs.map(async (input) => {
          return await Promise.all(
            projectGraphDeps.map(async (d) => {
              if (visited.indexOf(d.target) > -1) {
                return null;
              } else {
                visited.push(d.target);
                return await this.hashTask(
                  {
                    id: `${d.target}:$input:${input.input}`,
                    target: {
                      project: d.target,
                      target: '$input',
                      configuration: input.input,
                    },
                    overrides: {},
                  },
                  visited
                );
              }
            })
          );
        })
      )
    )
      .flat()
      .filter((r) => !!r);
  }

  private inputs(
    task: Task,
    projectNode: ProjectGraphProjectNode<any>
  ): { depsInputs: { input: string }[]; selfInputs: ExpandedSelfInput[] } {
    if (task.target.target === '$input') {
      return {
        depsInputs: [{ input: task.target.configuration }],
        selfInputs: expandNamedInput(task.target.configuration, {
          ...this.nxJson.namedInputs,
          ...projectNode.data.namedInputs,
        }),
      };
    } else {
      const targetData = projectNode.data.targets[task.target.target];
      const targetDefaults = (this.nxJson.targetDefaults || {})[
        task.target.target
      ];
      // task from TaskGraph can be added here
      return splitInputsIntoSelfAndDependencies(
        targetData.inputs || targetDefaults?.inputs || DEFAULT_INPUTS,
        { ...this.nxJson.namedInputs, ...projectNode.data.namedInputs }
      );
    }
  }

  private hashExternalDependency(task: Task) {
    const n = this.projectGraph.externalNodes[task.target.project];
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
      hash = `__${task.target.project}__`;
    }
    return {
      value: hash,
      details: {
        [task.target.project]: version || hash,
      },
    };
  }

  private async hashSelfInputs(
    task: Task,
    inputs: ExpandedSelfInput[]
  ): Promise<PartialHash[]> {
    const filesets = inputs
      .filter((r) => !!r['fileset'])
      .map((r) => r['fileset']);

    const projectFilesets = filesets.filter(
      (r) => !r.startsWith('{workspaceRoot}')
    );

    const rootFilesets = filesets.filter((r) =>
      r.startsWith('{workspaceRoot}/')
    );

    return Promise.all([
      this.hashTaskFileset(task, projectFilesets),
      ...[
        ...rootFilesets,
        ...this.legacyFilesetInputs.map((r) => r.fileset),
      ].map((fileset) => this.hashRootFileset(fileset)),
      ...[...inputs, ...this.legacyRuntimeInputs]
        .filter((r) => !r['fileset'])
        .map((r) =>
          r['runtime'] ? this.hashRuntime(r['runtime']) : this.hashEnv(r['env'])
        ),
    ]);
  }

  private async hashRootFileset(fileset: string): Promise<PartialHash> {
    const mapKey = fileset;
    const withoutWorkspaceRoot = fileset.substring(16);
    if (!this.filesetHashes[mapKey]) {
      this.filesetHashes[mapKey] = new Promise(async (res) => {
        const parts = [];
        if (fileset.indexOf('*') > -1) {
          this.projectGraph.allWorkspaceFiles
            .filter((f) => minimatch(f.file, withoutWorkspaceRoot))
            .forEach((f) => {
              parts.push(this.hashing.hashFile(join(workspaceRoot, f.file)));
            });
        } else {
          if (existsSync(join(workspaceRoot, withoutWorkspaceRoot))) {
            parts.push(
              this.hashing.hashFile(join(workspaceRoot, withoutWorkspaceRoot))
            );
          }
        }
        const value = this.hashing.hashArray(parts);
        res({
          value,
          details: { [mapKey]: value },
        });
      });
    }
    return this.filesetHashes[mapKey];
  }

  private async hashTaskFileset(
    task: Task,
    filesetPatterns: string[]
  ): Promise<PartialHash> {
    const mapKey = `${task.target.project}:$filesets`;
    if (!this.filesetHashes[mapKey]) {
      this.filesetHashes[mapKey] = new Promise(async (res) => {
        const p = this.projectGraph.nodes[task.target.project];
        const filteredFiles = this.filterFiles(p.data.files, filesetPatterns);
        const fileNames = filteredFiles.map((f) => f.file);
        const values = filteredFiles.map((f) => f.hash);

        let tsConfig: string;
        tsConfig = this.hashTsConfig(p);
        const value = this.hashing.hashArray([
          ...fileNames,
          ...values,
          JSON.stringify({ ...p.data, files: undefined }),
          tsConfig,
        ]);
        res({
          value,
          details: { [mapKey]: value },
        });
      });
    }
    return this.filesetHashes[mapKey];
  }

  private async hashRuntime(runtime: string): Promise<PartialHash> {
    const mapKey = `runtime:${runtime}`;
    if (!this.runtimeHashes[mapKey]) {
      this.runtimeHashes[mapKey] = new Promise((res, rej) => {
        exec(runtime, (err, stdout, stderr) => {
          if (err) {
            rej(
              new Error(`Nx failed to execute {runtime: '${runtime}'}. ${err}.`)
            );
          } else {
            const value = `${stdout}${stderr}`.trim();
            res({
              details: { [`runtime:${runtime}`]: value },
              value,
            });
          }
        });
      });
    }
    return this.runtimeHashes[mapKey];
  }

  private async hashEnv(envVarName: string): Promise<PartialHash> {
    const value = this.hashing.hashArray([process.env[envVarName] ?? '']);
    return {
      details: { [`env:${envVarName}`]: value },
      value,
    };
  }

  private filterFiles(files: FileData[], patterns: string[]) {
    patterns = patterns.filter((p) => p !== 'default');
    if (patterns.length === 0) return files;
    return files.filter(
      (f) => !!patterns.find((pattern) => minimatch(f.file, pattern))
    );
  }

  private hashTsConfig(p: ProjectGraphProjectNode) {
    if (this.options.selectivelyHashTsConfig) {
      return this.removeOtherProjectsPathRecords(p);
    } else {
      return JSON.stringify(this.tsConfigJson);
    }
  }

  private removeOtherProjectsPathRecords(p: ProjectGraphProjectNode) {
    const { paths, ...compilerOptions } = this.tsConfigJson.compilerOptions;
    const rootPath = p.data.root.split('/');
    rootPath.shift();
    const pathAlias = getImportPath(this.nxJson?.npmScope, rootPath.join('/'));

    return JSON.stringify({
      compilerOptions: {
        ...compilerOptions,
        paths: {
          [pathAlias]: paths[pathAlias] ?? [],
        },
      },
    });
  }
}

export function splitInputsIntoSelfAndDependencies(
  inputs: (InputDefinition | string)[],
  namedInputs: { [inputName: string]: (InputDefinition | string)[] }
): {
  depsInputs: { input: string }[];
  selfInputs: ExpandedSelfInput[];
} {
  const depsInputs = [];
  const selfInputs = [];
  for (const d of inputs) {
    if (typeof d === 'string') {
      if (d.startsWith('^')) {
        depsInputs.push({ input: d.substring(1) });
      } else {
        selfInputs.push(d);
      }
    } else {
      if ((d as any).projects === 'dependencies') {
        depsInputs.push(d as any);
      } else {
        selfInputs.push(d);
      }
    }
  }
  return { depsInputs, selfInputs: expandSelfInputs(selfInputs, namedInputs) };
}

function expandSelfInputs(
  inputs: (InputDefinition | string)[],
  namedInputs: { [inputName: string]: (InputDefinition | string)[] }
): ExpandedSelfInput[] {
  const expanded = [];
  for (const d of inputs) {
    if (typeof d === 'string') {
      if (d.startsWith('^'))
        throw new Error(`namedInputs definitions cannot start with ^`);

      if (namedInputs[d]) {
        expanded.push(...expandNamedInput(d, namedInputs));
      } else {
        expanded.push({ fileset: d });
      }
    } else {
      if ((d as any).projects === 'dependencies') {
        throw new Error(
          `namedInputs definitions cannot contain any inputs with projects == 'dependencies'`
        );
      }
      if ((d as any).fileset || (d as any).env || (d as any).runtime) {
        expanded.push(d);
      } else {
        expanded.push(...expandNamedInput((d as any).input, namedInputs));
      }
    }
  }
  return expanded;
}

export function expandNamedInput(
  input: string,
  namedInputs: { [inputName: string]: (InputDefinition | string)[] }
): ExpandedSelfInput[] {
  if (input === 'default') return [{ fileset: 'default' }];
  namedInputs ||= {};
  if (!namedInputs[input]) throw new Error(`Input '${input}' is not defined`);
  return expandSelfInputs(namedInputs[input], namedInputs);
}
