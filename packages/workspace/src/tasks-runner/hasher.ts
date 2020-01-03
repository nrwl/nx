import { ProjectGraph } from '../core/project-graph';
import { NxJson } from '../core/shared-interfaces';
import { Task } from './tasks-runner';
import { statSync } from 'fs';

const hasha = require('hasha');

export class Hasher {
  static version = '1.0';
  implicitDependencies: Promise<string>;
  fileHashes = new FileHashes();
  projectHashes = new ProjectHashes(this.projectGraph, this.fileHashes);

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJson
  ) {}

  async hash(task: Task): Promise<string> {
    const hash = await this.projectHashes.hashProject(task.target.project);
    const implicits = await this.implicitDepsHash();
    return hasha(
      [
        Hasher.version,
        task.target.project || '',
        task.target.target || '',
        task.target.configuration || '',
        JSON.stringify(task.overrides),
        implicits,
        hash
      ],
      { algorithm: 'sha256' }
    );
  }

  private async implicitDepsHash() {
    if (this.implicitDependencies) return this.implicitDependencies;

    const values = await Promise.all([
      ...Object.keys(this.nxJson.implicitDependencies).map(r =>
        this.fileHashes.hashFile(r)
      ),
      this.fileHashes.hashFile('package-lock.json'),
      this.fileHashes.hashFile('yarn.lock')
    ]);
    this.implicitDependencies = hasha(values, { algorithm: 'sha256' });
    return this.implicitDependencies;
  }
}

export class ProjectHashes {
  projectHashes: { [projectName: string]: Promise<string> } = {};

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly fileHashes: FileHashes
  ) {}

  async hashProject(projectName: string) {
    if (!this.projectHashes[projectName]) {
      this.projectHashes[projectName] = new Promise(async res => {
        const deps = (this.projectGraph.dependencies[projectName] || []).map(
          t => this.hashProject(t.target)
        );
        const sources = this.hashProjectNodeSource(projectName);
        res(hasha(await Promise.all([...deps, sources])));
      });
    }
    return this.projectHashes[projectName];
  }

  private async hashProjectNodeSource(projectName: string) {
    const p = this.projectGraph.nodes[projectName];
    const values = await Promise.all(
      p.data.files.map(f => this.fileHashes.hashFile(f.file))
    );
    return hasha(values, { algorithm: 'sha256' });
  }
}

export class FileHashes {
  private queue = [];
  private numberOfConcurrentReads = 0;
  private fileHashes: { [path: string]: Promise<string> } = {};
  private resolvers: { [path: string]: Function } = {};

  async hashFile(path: string) {
    if (!this.fileHashes[path]) {
      this.fileHashes[path] = new Promise(res => {
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
        .then(value => {
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
