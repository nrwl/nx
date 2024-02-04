/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';

export abstract class ExternalApi {
  abstract openProjectDetails(projectName: string, targetName?: string): void;

  abstract focusProject(projectName: string): void;

  abstract toggleSelectProject(projectName: string): void;

  abstract selectAllProjects(): void;

  abstract showAffectedProjects(): void;

  abstract focusTarget(projectName: string, targetName: string): void;

  abstract selectAllTargetsByName(targetName: string): void;

  abstract enableExperimentalFeatures(): void;

  abstract disableExperimentalFeatures(): void;

  loadProjectGraph:
    | ((url: string) => Promise<ProjectGraphClientResponse>)
    | null = null;
  loadTaskGraph: ((url: string) => Promise<TaskGraphClientResponse>) | null =
    null;
  loadExpandedTaskInputs:
    | ((taskId: string) => Promise<Record<string, Record<string, string[]>>>)
    | null = null;
  loadSourceMaps:
    | ((url: string) => Promise<Record<string, Record<string, string[]>>>)
    | null = null;

  graphInteractionEventListener:
    | ((event: { type: string; payload: any }) => void | undefined)
    | null = null;
}
