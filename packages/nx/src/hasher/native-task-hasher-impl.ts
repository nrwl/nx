import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import {
  ExternalObject,
  FileData,
  HashPlanner,
  HasherOptions,
  ProjectGraph as NativeProjectGraph,
  transferProjectGraph,
  TaskHasher,
  NxWorkspaceFilesExternals,
} from '../native';
import {
  transformNxJsonForRust,
  transformProjectGraphForRust,
} from '../native/transform-objects';
import { PartialHash, TaskHasherImpl } from './task-hasher';

export class NativeTaskHasherImpl implements TaskHasherImpl {
  hasher: TaskHasher;
  planner: HashPlanner;
  projectGraphRef: ExternalObject<NativeProjectGraph>;
  allWorkspaceFilesRef: ExternalObject<FileData[]>;
  projectFileMapRef: ExternalObject<Record<string, FileData[]>>;
  options: HasherOptions | undefined;

  constructor(
    private workspaceRoot: string,
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

    this.planner = new HashPlanner(
      transformNxJsonForRust(nxJson),
      this.projectGraphRef
    );
    this.hasher = new TaskHasher(
      workspaceRoot,
      this.projectGraphRef,
      this.projectFileMapRef,
      this.allWorkspaceFilesRef,
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
