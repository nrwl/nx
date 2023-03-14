import { exec } from 'child_process';
import * as minimatch from 'minimatch';
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

    if (process.env.NX_CLOUD_ENCRYPTION_KEY) {
      legacyRuntimeInputs.push({ env: 'NX_CLOUD_ENCRYPTION_KEY' });
    }

    const legacyFilesetInputs = [
      ...Object.keys(this.nxJson.implicitDependencies ?? {}),
      'nx.json',

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

  hashDependsOnOtherTasks(task: Task) {
    return false;
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
    for (let n of Object.keys(hash.details)) {
      if (n.startsWith(`${task.target.project}:`)) {
        return hash.details[n];
      }
    }
    return '';
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

const DEFAULT_INPUTS: ReadonlyArray<InputDefinition> = [
  {
    projects: 'self',
    fileset: '{projectRoot}/**/*',
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
        return this.hashExternalDependency(task.target.project);
      }
      const namedInputs = getNamedInputs(this.nxJson, projectNode);
      const targetData = projectNode.data.targets[task.target.target];
      const targetDefaults = (this.nxJson.targetDefaults || {})[
        task.target.target
      ];
      const { selfInputs, depsInputs } = splitInputsIntoSelfAndDependencies(
        targetData.inputs || targetDefaults?.inputs || (DEFAULT_INPUTS as any),
        namedInputs
      );

      const selfAndInputs = await this.hashSelfAndDepsInputs(
        task.target.project,
        selfInputs,
        depsInputs,
        visited
      );

      const target = this.hashTarget(task.target.project, task.target.target);
      if (target) {
        return {
          value: this.hashing.hashArray([selfAndInputs.value, target.value]),
          details: { ...selfAndInputs.details, ...target.details },
        };
      }
      return selfAndInputs;
    });
  }

  private async hashNamedInput(
    projectName: string,
    namedInput: string,
    visited: string[]
  ): Promise<PartialHash> {
    const projectNode = this.projectGraph.nodes[projectName];
    if (!projectNode) {
      return this.hashExternalDependency(projectName);
    }
    const namedInputs = {
      default: [{ fileset: '{projectRoot}/**/*' }],
      ...this.nxJson.namedInputs,
      ...projectNode.data.namedInputs,
    };

    const selfInputs = expandNamedInput(namedInput, namedInputs);
    const depsInputs = [{ input: namedInput }];
    return this.hashSelfAndDepsInputs(
      projectName,
      selfInputs,
      depsInputs,
      visited
    );
  }

  private async hashSelfAndDepsInputs(
    projectName: string,
    selfInputs: ExpandedSelfInput[],
    depsInputs: { input: string }[],
    visited: string[]
  ) {
    const projectGraphDeps = this.projectGraph.dependencies[projectName] ?? [];
    // we don't want random order of dependencies to change the hash
    projectGraphDeps.sort((a, b) => a.target.localeCompare(b.target));

    const self = await this.hashSelfInputs(projectName, selfInputs);
    const deps = await this.hashDepsInputs(
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
  }

  private async hashDepsInputs(
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
                return await this.hashNamedInput(
                  d.target,
                  input.input || 'default',
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

  private hashExternalDependency(projectName: string) {
    const n = this.projectGraph.externalNodes[projectName];
    const version = n?.data?.version;
    let hash: string;
    if (n?.data?.hash) {
      // we already know the hash of this dependency
      hash = n.data.hash;
    } else {
      // unknown dependency
      // this may occur if dependency is not an npm package
      // but rather symlinked in node_modules or it's pointing to a remote git repo
      // in this case we have no information about the versioning of the given package
      hash = version ? `__${projectName}@${version}__` : `__${projectName}__`;
    }
    return {
      value: hash,
      details: {
        [projectName]: version || hash,
      },
    };
  }

  private hashTarget(projectName: string, targetName: string): PartialHash {
    const projectNode = this.projectGraph.nodes[projectName];
    const target = projectNode.data.targets[targetName];

    if (!target) {
      return;
    }

    // we can only vouch for @nrwl packages's executors
    // if it's "run commands" we skip traversing since we have no info what this command depends on
    // for everything else we take the hash of the @nrwl package dependency tree
    if (
      target.executor.startsWith(`@nrwl/`) &&
      target.executor !== `@nrwl/workspace:run-commands`
    ) {
      const executorPackage = target.executor.split(':')[0];
      const executorNode = `npm:${executorPackage}`;
      if (this.projectGraph.externalNodes?.[executorNode]) {
        return this.hashExternalDependency(executorNode);
      }
    }

    const hash = this.hashing.hashArray([
      JSON.stringify(this.projectGraph.externalNodes),
    ]);
    return {
      value: hash,
      details: {
        [projectNode.name]: target.executor,
      },
    };
  }

  private async hashSelfInputs(
    projectName: string,
    inputs: ExpandedSelfInput[]
  ): Promise<PartialHash[]> {
    const filesets = extractPatternsFromFileSets(inputs);

    const projectFilesets = [];
    const workspaceFilesets = [];
    let invalidFilesetNoPrefix = null;
    let invalidFilesetWorkspaceRootNegative = null;

    for (let f of filesets) {
      if (f.startsWith('{projectRoot}/') || f.startsWith('!{projectRoot}/')) {
        projectFilesets.push(f);
      } else if (
        f.startsWith('{workspaceRoot}/') ||
        f.startsWith('!{workspaceRoot}/')
      ) {
        workspaceFilesets.push(f);
      } else {
        invalidFilesetNoPrefix = f;
      }
    }

    if (invalidFilesetNoPrefix) {
      throw new Error(
        [
          `"${invalidFilesetNoPrefix}" is an invalid fileset.`,
          'All filesets have to start with either {workspaceRoot} or {projectRoot}.',
          'For instance: "!{projectRoot}/**/*.spec.ts" or "{workspaceRoot}/package.json".',
          `If "${invalidFilesetNoPrefix}" is a named input, make sure it is defined in, for instance, nx.json.`,
        ].join('\n')
      );
    }
    if (invalidFilesetWorkspaceRootNegative) {
      throw new Error(
        [
          `"${invalidFilesetWorkspaceRootNegative}" is an invalid fileset.`,
          'It is not possible to negative filesets starting with {workspaceRoot}.',
        ].join('\n')
      );
    }

    const notFilesets = inputs.filter((r) => !r['fileset']);
    return Promise.all([
      this.hashProjectFileset(projectName, projectFilesets),
      ...[
        ...workspaceFilesets,
        ...this.legacyFilesetInputs.map((r) => r.fileset),
      ].map((fileset) => this.hashRootFileset(fileset)),
      ...[...notFilesets, ...this.legacyRuntimeInputs].map((r) =>
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
        const matchingFile = this.projectGraph.allWorkspaceFiles.find(
          (t) => t.file === withoutWorkspaceRoot
        );
        if (matchingFile) {
          parts.push(matchingFile.hash);
        } else {
          this.projectGraph.allWorkspaceFiles
            .filter((f) => minimatch(f.file, withoutWorkspaceRoot))
            .forEach((f) => {
              parts.push(f.hash);
            });
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

  private async hashProjectFileset(
    projectName: string,
    filesetPatterns: string[]
  ): Promise<PartialHash> {
    const mapKey = `${projectName}:${filesetPatterns.join(',')}`;
    if (!this.filesetHashes[mapKey]) {
      this.filesetHashes[mapKey] = new Promise(async (res) => {
        const p = this.projectGraph.nodes[projectName];
        const filteredFiles = filterUsingGlobPatterns(
          p.data.root,
          p.data.files,
          filesetPatterns
        );
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

export function getNamedInputs(
  nxJson: NxJsonConfiguration,
  project: ProjectGraphProjectNode
) {
  return {
    default: [{ fileset: '{projectRoot}/**/*' }],
    ...nxJson.namedInputs,
    ...project.data.namedInputs,
  };
}

export function getTargetInputs(
  nxJson: NxJsonConfiguration,
  projectNode: ProjectGraphProjectNode,
  target: string
) {
  const namedInputs = getNamedInputs(nxJson, projectNode);

  const targetData = projectNode.data.targets[target];
  const targetDefaults = (nxJson.targetDefaults || {})[target];

  const inputs = splitInputsIntoSelfAndDependencies(
    targetData.inputs || targetDefaults?.inputs || DEFAULT_INPUTS,
    namedInputs
  );

  const selfInputs = extractPatternsFromFileSets(inputs.selfInputs);

  const dependencyInputs = extractPatternsFromFileSets(
    inputs.depsInputs.map((s) => expandNamedInput(s.input, namedInputs)).flat()
  );

  return { selfInputs, dependencyInputs };
}

export function extractPatternsFromFileSets(
  inputs: readonly ExpandedSelfInput[]
): string[] {
  return inputs
    .filter((c): c is { fileset: string } => !!c['fileset'])
    .map((c) => c['fileset']);
}

export function splitInputsIntoSelfAndDependencies(
  inputs: ReadonlyArray<InputDefinition | string>,
  namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> }
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
  inputs: ReadonlyArray<InputDefinition | string>,
  namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> }
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
  namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> }
): ExpandedSelfInput[] {
  namedInputs ||= {};
  if (!namedInputs[input]) throw new Error(`Input '${input}' is not defined`);
  return expandSelfInputs(namedInputs[input], namedInputs);
}

export function filterUsingGlobPatterns(
  root: string,
  files: FileData[],
  patterns: string[]
): FileData[] {
  const filesetWithExpandedProjectRoot = patterns
    .map((f) => f.replace('{projectRoot}', root))
    .map((r) => {
      // handling root level projects that create './' pattern that doesn't work with minimatch
      if (r.startsWith('./')) return r.substring(2);
      if (r.startsWith('!./')) return '!' + r.substring(3);
      return r;
    });

  const positive = [];
  const negative = [];
  for (const p of filesetWithExpandedProjectRoot) {
    if (p.startsWith('!')) {
      negative.push(p);
    } else {
      positive.push(p);
    }
  }

  if (positive.length === 0 && negative.length === 0) {
    return files;
  }

  return files.filter((f) => {
    let matchedPositive = false;
    if (
      positive.length === 0 ||
      (positive.length === 1 && positive[0] === `${root}/**/*`)
    ) {
      matchedPositive = true;
    } else {
      matchedPositive = positive.some((pattern) => minimatch(f.file, pattern));
    }

    if (!matchedPositive) return false;

    return negative.every((pattern) => minimatch(f.file, pattern));
  });
}
