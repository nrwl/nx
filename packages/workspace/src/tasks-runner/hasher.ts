import { ProjectGraph } from '../core/project-graph';
import { NxJson } from '../core/shared-interfaces';
import { Task } from './tasks-runner';
import { statSync } from 'fs';
import { rootWorkspaceFileNames } from '../core/file-utils';
import { execSync } from 'child_process';

const hasha = require('hasha');

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

export class Hasher {
  static version = '1.0';
  implicitDependencies: Promise<ImplicitHashResult>;
  runtimeInputs: Promise<RuntimeHashResult>;
  fileHashes = new FileHashes();
  projectHashes = new ProjectHashes(this.projectGraph, this.fileHashes);

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJson,
    private readonly options: any
  ) {}

  async hash(task: Task): Promise<Hash> {
    const command = hasha(
      [
        task.target.project || '',
        task.target.target || '',
        task.target.configuration || '',
        JSON.stringify(task.overrides),
      ],
      { algorithm: 'sha256' }
    );

    const values = await Promise.all([
      this.projectHashes.hashProject(task.target.project, [
        task.target.project,
      ]),
      this.implicitDepsHash(),
      this.runtimeInputsHash(),
    ]);

    const value = hasha(
      [Hasher.version, command, ...values.map((v) => v.value)],
      {
        algorithm: 'sha256',
      }
    );

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

        const value = await hasha(
          values.map((v) => v.value),
          {
            algorithm: 'sha256',
          }
        );
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
      const fileHashes = await Promise.all(
        fileNames.map(async (file) => {
          const hash = await this.fileHashes.hashFile(file);
          return { file, hash };
        })
      );

      const combinedHash = await hasha(
        fileHashes.map((v) => v.hash),
        {
          algorithm: 'sha256',
        }
      );
      return {
        value: combinedHash,
        sources: fileHashes.reduce((m, c) => ((m[c.file] = c.hash), m), {}),
      };
    });
    return this.implicitDependencies;
  }
}

export class ProjectHashes {
  private sourceHashes: { [projectName: string]: Promise<string> } = {};

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly fileHashes: FileHashes
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
      const value = await hasha([
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
          p.data.files.map((f) => this.fileHashes.hashFile(f.file))
        );
        res(hasha(values, { algorithm: 'sha256' }));
      });
    }
    return this.sourceHashes[projectName];
  }
}

export class FileHashes {
  private queue = [];
  private numberOfConcurrentReads = 0;
  private fileHashes: { [path: string]: Promise<string> } = {};
  private resolvers: { [path: string]: Function } = {};

  async hashFile(path: string) {
    if (!this.fileHashes[path]) {
      this.fileHashes[path] = new Promise((res) => {
        this.resolvers[path] = res;
        this.pushFileIntoQueue(path);
      });
    }
    return this.fileHashes[path];
  }

  private pushFileIntoQueue(path: string) {
    this.queue.push(path);
    if (this.numberOfConcurrentReads < 2000) {
      this.numberOfConcurrentReads++;
      this.takeFromQueue();
    }
  }

  private takeFromQueue() {
    if (this.queue.length > 0) {
      const path = this.queue.pop();
      this.processPath(path)
        .then((value) => {
          this.resolvers[path](value);
        })
        .then(() => this.takeFromQueue());
    } else {
      this.numberOfConcurrentReads--;
    }
  }

  private processPath(path: string) {
    try {
      const stats = statSync(path);
      const fileSizeInMegabytes = stats.size / 1000000;
      // large binary file, skip it
      if (fileSizeInMegabytes > 5) {
        return Promise.resolve(stats.size.toString());
      } else {
        return hasha.fromFile(path, { algorithm: 'sha256' });
      }
    } catch (e) {
      return Promise.resolve('');
    }
  }
}
