import { exec } from 'child_process';
import { existsSync } from 'fs';
import * as minimatch from 'minimatch';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { getRootTsConfigFileName } from '../utils/typescript';
import { workspaceRoot } from '../utils/workspace-root';
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
import { readNxJson } from '../config/configuration';
import { InputDefinition } from '../config/workspace-json-project-json';
import { getImportPath } from '../utils/path';

/**
 * A data structure returned by the default hasher.
 */
export interface Hash {
  value: string;
  details: {
    command: string;
    nodes: { [name: string]: string };
    implicitDeps: { [fileName: string]: string };
    runtime: { [input: string]: string };
  };
}

interface TaskGraphResult {
  value: string;
  command: string;
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

/**
 * The default hasher used by executors.
 */
export class Hasher {
  static version = '3.0';
  private implicitDependencies: Promise<ImplicitHashResult>;
  private runtimeInputs: Promise<RuntimeHashResult>;
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
    this.taskHasher = new TaskHasher(this.projectGraph, this.hashing, {
      selectivelyHashTsConfig: this.options.selectivelyHashTsConfig ?? false,
    });
  }

  async hashTaskWithDepsAndContext(task: Task): Promise<Hash> {
    const values = (await Promise.all([
      this.taskHasher.hashTask(task, [task.target.project]),
      this.implicitDepsHash(),
      this.runtimeInputsHash(),
    ])) as [TaskGraphResult, ImplicitHashResult, RuntimeHashResult];

    const value = this.hashing.hashArray([
      Hasher.version,
      ...values.map((v) => v.value),
    ]);

    return {
      value,
      details: {
        command: values[0].command,
        nodes: values[0].nodes,
        implicitDeps: values[1].files,
        runtime: values[2].runtime,
      },
    };
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

  async hashCommand(task: Task): Promise<string> {
    return (await this.taskHasher.hashTask(task, [task.target.project]))
      .command;
  }

  async hashSource(task: Task): Promise<string> {
    return (await this.taskHasher.hashTask(task, [task.target.project])).value;
  }

  hashArray(values: string[]): string {
    return this.hashing.hashArray(values);
  }

  hashFile(path: string): string {
    return this.hashing.hashFile(path);
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

        'nx.json',

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
            // Normalize the path to always be absolute and starting with workspaceRoot so we can check it exists
            if (!maybeRelativePath.startsWith(workspaceRoot)) {
              return join(workspaceRoot, maybeRelativePath);
            }
            return maybeRelativePath;
          })
          .filter((file) => existsSync(file))
          .map((file) => {
            // we should use default file hasher here
            const hash = this.hashing.hashFile(file);
            return { file, hash };
          }),
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
    [taskId: string]: Promise<{ taskId: string; value: string }>;
  } = {};
  private tsConfigJson: TsconfigJsonConfiguration;
  private nxJson: NxJsonConfiguration;

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly hashing: HashingImpl,
    private readonly options: { selectivelyHashTsConfig: boolean }
  ) {
    this.tsConfigJson = this.readTsConfig();
    this.nxJson = readNxJson();
  }

  async hashTask(task: Task, visited: string[]): Promise<TaskGraphResult> {
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

      const command = this.hashCommand(task);

      const nodes = deps.reduce((m, c) => {
        return { ...m, ...c.nodes };
      }, {});
      nodes[self.taskId] = self.value;

      const value = this.hashing.hashArray([
        command,
        self.value,
        ...deps.map((d) => d.value),
      ]);

      return { value, command, nodes };
    });
  }

  private async hashDepsTasks(
    inputs: { input: string }[],
    projectGraphDeps: ProjectGraphDependency[],
    visited: string[]
  ) {
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

  private async hashSelfInputs(task: Task, inputs: { fileset: string }[]) {
    return this.hashFilesetSource(
      task,
      inputs.map((r) => r.fileset)
    );
  }

  private inputs(
    task: Task,
    projectNode: ProjectGraphProjectNode<any>
  ): { depsInputs: { input: string }[]; selfInputs: { fileset: string }[] } {
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
      const targetDefaults = this.nxJson.targetDefaults[task.target.target];
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
      command: '',
      nodes: {
        [task.target.project]: version || hash,
      },
    };
  }

  private hashCommand(task: Task) {
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

  private async hashFilesetSource(
    task: Task,
    filesetPatterns: string[]
  ): Promise<{ taskId: string; value: string }> {
    const mapKey = `${task.target.project}:$filesets`;
    if (!this.filesetHashes[mapKey]) {
      this.filesetHashes[mapKey] = new Promise(async (res) => {
        const p = this.projectGraph.nodes[task.target.project];
        const filteredFiles = this.filterFiles(p.data.files, filesetPatterns);
        const fileNames = filteredFiles.map((f) => f.file);
        const values = filteredFiles.map((f) => f.hash);

        let tsConfig: string;
        tsConfig = this.hashTsConfig(p);
        res({
          taskId: mapKey,
          value: this.hashing.hashArray([
            ...fileNames,
            ...values,
            JSON.stringify({ ...p.data, files: undefined }),
            tsConfig,
          ]),
        });
      });
    }
    return this.filesetHashes[mapKey];
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

export function splitInputsIntoSelfAndDependencies(
  inputs: (InputDefinition | string)[],
  namedInputs: { [inputName: string]: (InputDefinition | string)[] }
): { depsInputs: { input: string }[]; selfInputs: { fileset: string }[] } {
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
): { fileset: string }[] {
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
      if ((d as any).fileset) {
        expanded.push({ fileset: (d as any).fileset });
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
): { fileset: string }[] {
  if (input === 'default') return [{ fileset: 'default' }];
  namedInputs ||= {};
  if (!namedInputs[input]) throw new Error(`Input '${input}' is not defined`);
  return expandSelfInputs(namedInputs[input], namedInputs);
}
