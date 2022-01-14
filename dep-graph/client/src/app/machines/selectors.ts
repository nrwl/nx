import type { ProjectGraphNode } from '@nrwl/devkit';
import { DepGraphSelector } from '../hooks/use-dep-graph-selector';
import { WorkspaceLayout } from '../interfaces';
import { GraphPerfReport } from './interfaces';

export const allProjectsSelector: DepGraphSelector<ProjectGraphNode[]> = (
  state
) => state.context.projects;

export const workspaceLayoutSelector: DepGraphSelector<WorkspaceLayout> = (
  state
) => state.context.workspaceLayout;

export const selectedProjectNamesSelector: DepGraphSelector<string[]> = (
  state
) => state.context.selectedProjects;

export const projectIsSelectedSelector: DepGraphSelector<boolean> = (state) =>
  state.context.selectedProjects.length > 0;

export const lastPerfReportSelector: DepGraphSelector<GraphPerfReport> = (
  state
) => state.context.lastPerfReport;

export const focusedProjectNameSelector: DepGraphSelector<string> = (state) =>
  state.context.focusedProject;

export const searchDepthSelector: DepGraphSelector<{
  searchDepth: number;
  searchDepthEnabled: boolean;
}> = (state) => ({
  searchDepth: state.context.searchDepth,
  searchDepthEnabled: state.context.searchDepthEnabled,
});

export const includePathSelector: DepGraphSelector<boolean> = (state) =>
  state.context.includePath;

export const groupByFolderSelector: DepGraphSelector<boolean> = (state) =>
  state.context.groupByFolder;

export const textFilterSelector: DepGraphSelector<string> = (state) =>
  state.context.textFilter;

export const hasAffectedProjectsSelector: DepGraphSelector<boolean> = (state) =>
  state.context.affectedProjects.length > 0;
