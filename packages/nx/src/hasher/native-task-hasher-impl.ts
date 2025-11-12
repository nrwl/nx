import { NxJsonConfiguration } from '../config/nx-json.js';
import { ProjectGraph } from '../config/project-graph.js';
import { Task, TaskGraph } from '../config/task-graph.js';
import {
  ExternalObject,
  FileData,
  HasherOptions,
  HashPlanner,
  NxWorkspaceFilesExternals,
  ProjectGraph as NativeProjectGraph,
  TaskHasher,
  transferProjectGraph,
} from '../native/index.js';
import { transformProjectGraphForRust } from '../native/transform-objects.js';
import { PartialHash, TaskHasherImpl } from './task-hasher.js';
import { readJsonFile } from '../utils/fileutils.js';
import { getRootTsConfigPath } from '../plugins/js/utils/typescript.js';

export class NativeTaskHasherImpl implements TaskHasherImpl {
  hasher: TaskHasher;
  planner: HashPlanner;
  projectGraphRef: ExternalObject<NativeProjectGraph>;
  allWorkspaceFilesRef: ExternalObject<FileData[]>;
  projectFileMapRef: ExternalObject<Record<string, FileData[]>>;
  options: HasherOptions | undefined;

  constructor(
    workspaceRoot: string,
    nxJson: NxJsonConfiguration,
    projectGraph: ProjectGraph,
    externals: NxWorkspaceFilesExternals,
    options: { selectivelyHashTsConfig: boolean }
  ) {
    this.projectGraphRef = transferProjectGraph(
      transformProjectGraphForRust(projectGraph)
    );

    this.allWorkspaceFilesRef = externals.allWorkspaceFiles;
    this.projectFileMapRef = externals.projectFiles;

    let tsconfig: { compilerOptions?: import('typescript').CompilerOptions } =
      {};
    let paths = {};
    let rootTsConfigPath = getRootTsConfigPath();
    if (rootTsConfigPath) {
      tsconfig = readJsonFile(getRootTsConfigPath());
      paths = tsconfig.compilerOptions?.paths ?? {};
      if (tsconfig.compilerOptions?.paths) {
        delete tsconfig.compilerOptions.paths;
      }
    }

    this.planner = new HashPlanner(nxJson, this.projectGraphRef);
    this.hasher = new TaskHasher(
      workspaceRoot,
      this.projectGraphRef,
      this.projectFileMapRef,
      this.allWorkspaceFilesRef,
      Buffer.from(JSON.stringify(tsconfig)),
      paths,
      options
    );
  }

  async hashTask(
    task: Task,
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv
  ): Promise<PartialHash> {
    const plans = this.planner.getPlansReference([task.id], taskGraph);
    const hashes = this.hasher.hashPlans(plans, env);

    return hashes[task.id];
  }

  async hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv
  ): Promise<PartialHash[]> {
    const plans = this.planner.getPlansReference(
      tasks.map((t) => t.id),
      taskGraph
    );
    const hashes = this.hasher.hashPlans(plans, env);
    return tasks.map((t) => hashes[t.id]);
  }
}
