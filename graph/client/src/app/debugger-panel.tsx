import { memo } from 'react';
import { ProjectGraphList } from './interfaces';
import { GraphPerfReport } from './machines/interfaces';

export interface DebuggerPanelProps {
  projectGraphs: ProjectGraphList[];
  selectedProjectGraph: string;
  projectGraphChange: (projectName: string) => void;
  lastPerfReport: GraphPerfReport;
}

export const DebuggerPanel = memo(function ({
  projectGraphs,
  selectedProjectGraph,
  projectGraphChange,
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
      <select
        className="flex w-auto items-center rounded-md rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
        data-cy="project-select"
        onChange={(event) => projectGraphChange(event.target.value)}
        value={selectedProjectGraph}
      >
        {projectGraphs.map((projectGraph) => {
          return (
            <option key={projectGraph.id} value={projectGraph.id}>
              {projectGraph.label}
            </option>
          );
        })}
      </select>
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

export default DebuggerPanel;
