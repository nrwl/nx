import { ProjectGraph, ProjectGraphNode } from '../core/project-graph';
import { NxJson } from '../core/shared-interfaces';
import { Task } from './tasks-runner';
import { statSync } from 'fs';
const hasha = require('hasha');

export class Hasher {
  static version = '1.0';
  implicitDependencies: string;
  hashes: { [k: string]: string } = {};

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly nxJson: NxJson
  ) {}

  async hash(task: Task): Promise<string> {
    const ps = await Promise.all(
      this.traverseInDepthFirstOrder(task).map(p => this.hashProjectNode(p))
    );
    const implicits = await this.implicitDepsHash();
    return hasha(
      [
        Hasher.version,
        task.target.project || '',
        task.target.target || '',
        task.target.configuration || '',
        JSON.stringify(task.overrides),
        implicits,
        ...ps
      ],
      { algorithm: 'sha256' }
    );
  }

  private traverseInDepthFirstOrder(task: Task): ProjectGraphNode[] {
    const r = [];
    this.traverseNode(task.target.project, r);
    return r.map(rr => this.projectGraph.nodes[rr]);
  }

  private traverseNode(project: string, acc: string[]): void {
    if (acc.indexOf(project) > -1) return;
    acc.push(project);
    (this.projectGraph.dependencies[project] || [])
      .map(t => t.target)
      .forEach(r => {
        this.traverseNode(r, acc);
      });
  }

  private async hashProjectNode(p: ProjectGraphNode) {
    if (this.hashes[p.name]) {
      return this.hashes[p.name];
    } else {
      const values = await Promise.all(
        p.data.files.map(f => this.readFileContents(f.file))
      );
      const r = hasha(values, { algorithm: 'sha256' });
      this.hashes[p.name] = r;
      return r;
    }
  }

  private async implicitDepsHash() {
    if (this.implicitDependencies) return this.implicitDependencies;

    const values = await Promise.all([
      ...Object.keys(this.nxJson.implicitDependencies).map(r =>
        this.readFileContents(r)
      ),
      this.readFileContents('package-lock.json'),
      this.readFileContents('yarn.lock')
    ]);
    this.implicitDependencies = hasha(values, { algorithm: 'sha256' });
    return this.implicitDependencies;
  }

  private readFileContents(path: string): Promise<string> {
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
