import { ProjectGraph } from '../project-graph';
import { NxJson } from '../shared-interfaces';
import { Task } from '../../tasks-runner/tasks-runner';
import { readFileSync } from 'fs';
import { rootWorkspaceFileNames } from '../file-utils';
import { execSync } from 'child_process';
import {
  defaultFileHasher,
  extractNameAndVersion,
  FileHasher,
} from './file-hasher';
import { defaultHashing, HashingImp } from './hashing-impl';

const resolve = require('resolve');

export interface Hash {
  value: string;
  details: {
    command: string;
    sources: { [projectName: string]: string };
    implicitDeps: { [key: string]: string };
    runtime: { [input: string]: string };
  };
}

interface ProjectHashResult {
  value: string;
  sources: { [projectName: string]: string };
}

interface ImplicitHashResult {
  value: string;
  sources: { [fileName: string]: string };
}

interface RuntimeHashResult {
  value: string;
  runtime: { [input: string]: string };
}

interface NodeModulesResult {
  value: string;
}

export class Hasher {
  static version = '1.0';
  private implicitDependencies: Promise<ImplicitHashResult>;
  private nodeModules: Promise<NodeModulesResult>;
  private runtimeInputs: Promise<RuntimeHashResult>;
  private fileHasher: FileHasher;
  private projectHashes: ProjectHasher;
  private hashing: HashingImp;

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJson,
    private readonly options: any,
    hashing: HashingImp = undefined
  ) {
    if (!hashing) {
      this.hashing = defaultHashing;
      this.fileHasher = defaultFileHasher;
    } else {
      this.hashing = hashing;
      this.fileHasher = new FileHasher(hashing);
    }
    this.projectHashes = new ProjectHasher(
      this.projectGraph,
      this.fileHasher,
      this.hashing
    );
  }

  async hashTasks(tasks: Task[]): Promise<Hash[]> {
    return Promise.all(tasks.map((t) => this.hash(t)));
  }

  private async hash(task: Task): Promise<Hash> {
    const command = this.hashing.hashArray([
      task.target.project || '',
      task.target.target || '',
      task.target.configuration || '',
      JSON.stringify(task.overrides),
    ]);

    const values = (await Promise.all([
      this.projectHashes.hashProject(task.target.project, [
        task.target.project,
      ]),
      this.implicitDepsHash(),
      this.runtimeInputsHash(),
      this.nodeModulesHash(),
    ])) as [
      ProjectHashResult,
      ImplicitHashResult,
      RuntimeHashResult,
      NodeModulesResult
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
        sources: values[0].sources,
        implicitDeps: values[1].sources,
        runtime: values[2].runtime,
      },
    };
  }

  private async runtimeInputsHash(): Promise<RuntimeHashResult> {
    if (this.runtimeInputs) return this.runtimeInputs;

    const inputs =
      this.options && this.options.runtimeCacheInputs
        ? this.options.runtimeCacheInputs
        : [];
    if (inputs.length > 0) {
      try {
        const values = (await Promise.all(
          inputs.map(async (input) => {
            const value = execSync(input).toString().trim();
            return { input, value };
          })
        )) as any;

        const value = this.hashing.hashArray(values.map((v) => v.value));
        const runtime = values.reduce(
          (m, c) => ((m[c.input] = c.value), m),
          {}
        );
        return { value, runtime };
      } catch (e) {
        throw new Error(
          `Nx failed to execute runtimeCacheInputs defined in nx.json failed:\n${e.message}`
        );
      }
    } else {
      this.runtimeInputs = Promise.resolve({ value: '', runtime: {} });
    }

    return this.runtimeInputs;
  }

  private async implicitDepsHash(): Promise<ImplicitHashResult> {
    if (this.implicitDependencies) return this.implicitDependencies;

    const fileNames = [
      ...Object.keys(this.nxJson.implicitDependencies || {}),
      ...rootWorkspaceFileNames(),
      'package-lock.json',
      'yarn.lock',
    ];

    this.implicitDependencies = Promise.resolve().then(async () => {
      const fileHashes = fileNames.map((file) => {
        const hash = this.fileHasher.hashFile(file);
        return { file, hash };
      });
      const combinedHash = this.hashing.hashArray(
        fileHashes.map((v) => v.hash)
      );
      return {
        value: combinedHash,
        sources: fileHashes.reduce((m, c) => ((m[c.file] = c.hash), m), {}),
      };
    });
    return this.implicitDependencies;
  }

  private async nodeModulesHash() {
    if (this.nodeModules) return this.nodeModules;

    this.nodeModules = Promise.resolve().then(async () => {
      try {
        const j = JSON.parse(readFileSync('package.json').toString());
        const allPackages = [
          ...Object.keys(j.dependencies),
          ...Object.keys(j.devDependencies),
        ];
        const packageJsonHashes = allPackages.map((d) => {
          try {
            const path = resolve.sync(`${d}/package.json`, {
              basedir: process.cwd(),
            });
            return this.fileHasher.hashFile(path, extractNameAndVersion);
          } catch (e) {
            return '';
          }
        });
        return { value: this.hashing.hashArray(packageJsonHashes) };
      } catch (e) {
        return { value: '' };
      }
    });

    return this.nodeModules;
  }
}

class ProjectHasher {
  private sourceHashes: { [projectName: string]: Promise<string> } = {};

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly fileHasher: FileHasher,
    private readonly hashing: HashingImp
  ) {}

  async hashProject(
    projectName: string,
    visited: string[]
  ): Promise<ProjectHashResult> {
    return Promise.resolve().then(async () => {
      const deps = this.projectGraph.dependencies[projectName] || [];
      const depHashes = (
        await Promise.all(
          deps.map(async (d) => {
            if (visited.indexOf(d.target) > -1) {
              return null;
            } else {
              visited.push(d.target);
              return await this.hashProject(d.target, visited);
            }
          })
        )
      ).filter((r) => !!r);
      const projectHash = await this.hashProjectNodeSource(projectName);
      const sources = depHashes.reduce(
        (m, c) => {
          return { ...m, ...c.sources };
        },
        { [projectName]: projectHash }
      );
      const value = this.hashing.hashArray([
        ...depHashes.map((d) => d.value),
        projectHash,
      ]);
      return { value, sources };
    });
  }

  private async hashProjectNodeSource(projectName: string) {
    if (!this.sourceHashes[projectName]) {
      this.sourceHashes[projectName] = new Promise(async (res) => {
        const p = this.projectGraph.nodes[projectName];
        const values = await Promise.all(
          p.data.files.map((f) => this.fileHasher.hashFile(f.file))
        );
        res(this.hashing.hashArray(values));
      });
    }
    return this.sourceHashes[projectName];
  }
}
