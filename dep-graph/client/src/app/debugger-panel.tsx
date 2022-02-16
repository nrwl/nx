import { ProjectGraphList } from './interfaces';
import { GraphPerfReport } from './machines/interfaces';
import { memo } from 'react';

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
      className="
          flex-column
          flex
          w-auto
          items-center justify-items-center
          gap-4
          border-b border-gray-200
          bg-gray-50
          p-4
          text-gray-700
        "
    >
      <h4 className="mr-4 text-lg font-bold">Debugger</h4>
      <select
        className="flex w-auto items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
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
