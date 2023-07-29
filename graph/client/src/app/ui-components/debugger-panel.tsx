import { memo } from 'react';
import { WorkspaceData, GraphPerfReport } from '../interfaces';
import { Dropdown } from '@nx/graph/ui-components';

export interface DebuggerPanelProps {
  projects: WorkspaceData[];
  selectedProject: string;
  selectedProjectChange: (projectName: string) => void;
  lastPerfReport: GraphPerfReport;
}

export const DebuggerPanel = memo(function ({
  projects,
  selectedProject,
  selectedProjectChange,
  lastPerfReport,
}: DebuggerPanelProps) {
  return (
    <div
      data-cy="debugger-panel"
      className="flex-column flex w-auto items-center items-center justify-items-center justify-items-center gap-4 border-b border-slate-900/10 bg-slate-50 p-4 transition-all dark:border-slate-300/10 dark:bg-transparent"
    >
      <h4 className="dark:text-sidebar-title-dark mr-4 text-lg font-normal">
        Debugger
      </h4>
      <Dropdown
        data-cy="project-select"
        defaultValue={selectedProject}
        onChange={(event) => selectedProjectChange(event.currentTarget.value)}
      >
        {projects.map((projectGraph) => {
          return (
            <option key={projectGraph.id} value={projectGraph.id}>
              {projectGraph.label}
            </option>
          );
        })}
      </Dropdown>
      <p className="text-sm">
        Last render took {lastPerfReport.renderTime}ms:{' '}
        <b className="text-medium font-mono">{lastPerfReport.numNodes} nodes</b>{' '}
        |{' '}
        <b className="text-medium font-mono">{lastPerfReport.numEdges} edges</b>
        .
      </p>
    </div>
  );
});
