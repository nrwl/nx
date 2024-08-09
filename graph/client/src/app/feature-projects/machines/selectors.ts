/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
/* eslint-enable @nx/enforce-module-boundaries */
import { ProjectGraphSelector } from '../hooks/use-project-graph-selector';
import {
  CompositeNode,
  GraphPerfReport,
  WorkspaceLayout,
} from '../../interfaces';
import { TracingAlgorithmType } from './interfaces';

export const allProjectsSelector: ProjectGraphSelector<
  ProjectGraphProjectNode[]
> = (state) => state.context.projects;

export const workspaceLayoutSelector: ProjectGraphSelector<WorkspaceLayout> = (
  state
) => state.context.workspaceLayout;

export const selectedProjectNamesSelector: ProjectGraphSelector<string[]> = (
  state
) => state.context.selectedProjects;

export const projectIsSelectedSelector: ProjectGraphSelector<boolean> = (
  state
) => state.context.selectedProjects.length > 0;

export const lastPerfReportSelector: ProjectGraphSelector<GraphPerfReport> = (
  state
) => state.context.lastPerfReport;

export const focusedProjectNameSelector: ProjectGraphSelector<string> = (
  state
) => state.context.focusedProject;

export const searchDepthSelector: ProjectGraphSelector<{
  searchDepth: number;
  searchDepthEnabled: boolean;
}> = (state) => ({
  searchDepth: state.context.searchDepth,
  searchDepthEnabled: state.context.searchDepthEnabled,
});

export const includePathSelector: ProjectGraphSelector<boolean> = (state) =>
  state.context.includePath;

export const groupByFolderSelector: ProjectGraphSelector<boolean> = (state) =>
  state.context.groupByFolder;

export const collapseEdgesSelector: ProjectGraphSelector<boolean> = (state) =>
  state.context.collapseEdges;
export const compositeGraphEnabledSelector: ProjectGraphSelector<boolean> = (
  state
) => state.context.compositeGraph.enabled;
export const compositeContextSelector: ProjectGraphSelector<string | null> = (
  state
) => state.context.compositeGraph.context;
export const compositeNodesSelector: ProjectGraphSelector<CompositeNode[]> = (
  state
) => state.context.compositeGraph.nodes;

export const textFilterSelector: ProjectGraphSelector<string> = (state) =>
  state.context.textFilter;

export const hasAffectedProjectsSelector: ProjectGraphSelector<boolean> = (
  state
) => state.context.affectedProjects.length > 0;

export const getTracingInfo: ProjectGraphSelector<{
  start: string;
  end: string;
  algorithm: TracingAlgorithmType;
}> = (state) => state.context.tracing;
