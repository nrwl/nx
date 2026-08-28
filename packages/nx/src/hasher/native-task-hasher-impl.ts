import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import {
  ExternalObject,
  FileData,
  HasherOptions,
  HashPlanner,
  IoSnapshots,
  ProjectGraph as NativeProjectGraph,
  NxWorkspaceFilesExternals,
  TaskHasher,
  transferProjectGraph,
} from '../native';
import { transformProjectGraphForRust } from '../native/transform-objects';
import type { TaskPlanningContext } from './task-planning-context';
import { getRootTsConfigPath } from '../plugins/js/utils/typescript';
import { getTaskIOService } from '../tasks-runner/task-io-service';
import { readJsonFile } from '../utils/fileutils';
import { customHasherTaskIds } from '../io-snapshots/overrides';
import { PartialHash, TaskHasherImpl } from './task-hasher';

export class NativeTaskHasherImpl implements TaskHasherImpl {
  hasher: TaskHasher;
  planner: HashPlanner;
  projectGraphRef: ExternalObject<NativeProjectGraph>;
  allWorkspaceFilesRef: ExternalObject<FileData[]>;
  projectFileMapRef: ExternalObject<Record<string, FileData[]>>;
  options: HasherOptions | undefined;

  constructor(
    workspaceRoot: string,
    private readonly nxJson: NxJsonConfiguration,
    private readonly projectGraph: ProjectGraph,
    externals: NxWorkspaceFilesExternals,
    options: { selectivelyHashTsConfig: boolean },
    planningContext?: TaskPlanningContext
  ) {
    // Reuses the marshal and planner memo when affected already built them for
    // this graph; otherwise this is the only phase that needs them.
    this.projectGraphRef =
      planningContext?.projectGraphRef ??
      transferProjectGraph(transformProjectGraphForRust(projectGraph));

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

    this.planner =
      planningContext?.planner ?? new HashPlanner(nxJson, this.projectGraphRef);
    this.hasher = new TaskHasher(
      workspaceRoot,
      this.projectGraphRef,
      this.projectFileMapRef,
      this.allWorkspaceFilesRef,
      Buffer.from(JSON.stringify(tsconfig)),
      paths,
      rootTsConfigPath,
      options
    );
  }

  async hashTask(
    task: Task,
    taskGraph: TaskGraph,
    env: NodeJS.ProcessEnv,
    cwd?: string,
    collectInputs?: boolean,
    ioSnapshots?: IoSnapshots
  ): Promise<PartialHash> {
    const hashes = await this.hashTasks(
      [task],
      taskGraph,
      { [task.id]: env },
      cwd,
      collectInputs,
      ioSnapshots
    );
    return hashes[0];
  }

  async hashTasks(
    tasks: Task[],
    taskGraph: TaskGraph,
    perTaskEnvs: Record<string, NodeJS.ProcessEnv>,
    cwd?: string,
    collectInputs?: boolean,
    ioSnapshots?: IoSnapshots
  ): Promise<PartialHash[]> {
    const plans = this.planner.getPlansReference(
      tasks.map((t) => t.id),
      taskGraph,
      ioSnapshots,
      ioSnapshots
        ? customHasherTaskIds(this.projectGraph, taskGraph)
        : undefined
    );
    const shouldCollectInputs =
      collectInputs ?? getTaskIOService().hasTaskInputSubscribers();
    const hashes = this.hasher.hashPlans(
      plans,
      perTaskEnvs as Record<string, Record<string, string>>,
      cwd ?? process.cwd(),
      shouldCollectInputs
    );
    return tasks.map((t) => hashes[t.id]);
  }
}
