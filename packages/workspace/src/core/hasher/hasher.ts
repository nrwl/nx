import {
  NxJsonConfiguration,
  ProjectGraph,
  readJsonFile,
  Task,
  WorkspaceJsonConfiguration,
} from '@nrwl/devkit';
import { resolveNewFormatWithInlineProjects } from '@nrwl/tao/src/shared/workspace';
import { exec } from 'child_process';
import { performance } from 'perf_hooks';
import { resolvePathFromRoot } from '../../utilities/fileutils';
import { workspaceFileName } from '../file-utils';
import { defaultHashing, HashingImpl } from './hashing-impl';
import { ImplicitDepsHasher, ImplicitHashResult } from './implicit-deps-hasher';

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
  implicitDeps: { [fileName: string]: string };
}

interface RuntimeHashResult {
  value: string;
  runtime: { [input: string]: string };
}

interface CompilerOptions {
  paths: Record<string, string[]>;
}

interface TsConfigJsonConfiguration {
  compilerOptions: CompilerOptions;
}

export class Hasher {
  static version = '2.0';
  private runtimeInputs: Promise<RuntimeHashResult>;
  private implicitDepsHasher: ImplicitDepsHasher;
  private projectHasher: ProjectHasher;
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
    this.implicitDepsHasher = new ImplicitDepsHasher(
      this.projectGraph,
      this.nxJson,
      this.hashing
    );
    this.projectHasher = new ProjectHasher(
      this.projectGraph,
      this.hashing,
      this.implicitDepsHasher,
      { selectivelyHashTsConfig: this.options.selectivelyHashTsConfig ?? false }
    );
  }

  async hashTaskWithDepsAndContext(task: Task): Promise<Hash> {
    const command = this.hashCommand(task);

    const values = (await Promise.all([
      this.projectHasher.hashProject(task.target.project, [
        task.target.project,
      ]),
      this.runtimeInputsHash(),
    ])) as [ProjectHashResult, RuntimeHashResult];

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
        implicitDeps: values[0].implicitDeps,
        runtime: values[1].runtime,
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

  async hashContext(task: Task): Promise<{
    implicitDeps: ImplicitHashResult;
    runtime: RuntimeHashResult;
  }> {
    const values = (await Promise.all([
      this.implicitDepsHasher.hashImplicitDeps(task.target.project),
      this.runtimeInputsHash(),
    ])) as [ImplicitHashResult, RuntimeHashResult];

    return {
      implicitDeps: values[0],
      runtime: values[1],
    };
  }

  async hashSource(task: Task): Promise<string> {
    return this.projectHasher.hashProjectNodeSource(task.target.project);
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
}

class ProjectHasher {
  private sourceHashes: { [projectName: string]: Promise<string> } = {};
  private workspaceJson: WorkspaceJsonConfiguration;
  private nxJson: NxJsonConfiguration;
  private tsConfigJson: TsConfigJsonConfiguration;

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly hashing: HashingImpl,
    private readonly implicitDepsHasher: ImplicitDepsHasher,
    private readonly options: { selectivelyHashTsConfig: boolean }
  ) {
    this.workspaceJson = this.readWorkspaceConfigFile(
      resolvePathFromRoot(workspaceFileName())
    );
    this.nxJson = this.readNxJsonConfigFile(resolvePathFromRoot('nx.json'));
    this.tsConfigJson = this.readTsConfig();
  }

  async hashProject(
    projectName: string,
    visited: string[]
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
              return await this.hashProject(d.target, visited);
            }
          })
        )
      ).filter((r) => !!r);
      const projectHash = await this.hashProjectNodeSource(projectName);
      const nodes = depHashes.reduce(
        (m, c) => {
          return { ...m, ...c.nodes };
        },
        { [projectName]: projectHash }
      );

      const implicitDeps = await this.implicitDepsHasher.hashImplicitDeps(
        projectName
      );

      const value = this.hashing.hashArray([
        ...depHashes.map((d) => d.value),
        implicitDeps.value,
        projectHash,
      ]);

      return {
        value,
        nodes,
        implicitDeps: implicitDeps.files,
      };
    });
  }

  async hashProjectNodeSource(projectName: string) {
    if (!this.sourceHashes[projectName]) {
      this.sourceHashes[projectName] = new Promise(async (res) => {
        const p = this.projectGraph.nodes[projectName];

        if (!p) {
          const n = this.projectGraph.externalNodes[projectName];
          res(this.hashing.hashArray([n.data.version]));
          return;
        }

        const fileNames = p.data.files.map((f) => f.file);
        const values = p.data.files.map((f) => f.hash);

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
    return this.sourceHashes[projectName];
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
      const res = readJsonFile(resolvePathFromRoot('tsconfig.base.json'));
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
