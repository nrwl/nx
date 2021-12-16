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
      id="debugger-panel"
      className="
          w-auto
          text-gray-700
          bg-gray-50
          border-b border-gray-200
          p-4
          flex flex-column
          items-center
          justify-items-center
          gap-4
        "
    >
      <h4 className="text-lg font-bold mr-4">Debugger</h4>
      <select
        className="w-auto flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white"
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
        <b className="font-mono text-medium">{lastPerfReport.numNodes} nodes</b>{' '}
        |{' '}
        <b className="font-mono text-medium">{lastPerfReport.numEdges} edges</b>
        .
      </p>
    </div>
  );
});

export default DebuggerPanel;
