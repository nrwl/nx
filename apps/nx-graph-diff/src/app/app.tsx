import { useState, useEffect } from 'react';
import ProjectGraph from './components/ProjectGraph';
import NxJsonEditor from './components/NxJsonEditor';
import DiffViewer from './components/DiffViewer';
import './app.module.css';

export function App() {
  const [originalGraph, setOriginalGraph] = useState<any>(null);
  const [currentGraph, setCurrentGraph] = useState<any>(null);
  const [nxJson, setNxJson] = useState<any>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    // Load the current project graph
    fetch('/.nx/workspace-data/project-graph.json')
      .then((res) => res.json())
      .then((data) => {
        setOriginalGraph(data);
        setCurrentGraph(data);
      })
      .catch((err) => console.error('Failed to load project graph:', err));

    // Load nx.json
    fetch('/nx.json')
      .then((res) => res.json())
      .then((data) => setNxJson(data))
      .catch((err) => console.error('Failed to load nx.json:', err));
  }, []);

  const handleNxJsonUpdate = async (updatedNxJson: any) => {
    try {
      const response = await fetch('/api/update-nx-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nxJson: updatedNxJson }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setCurrentGraph(result.graph);
        setNxJson(updatedNxJson);
        setShowDiff(true);
      } else {
        console.error('Failed to update graph:', result.error);
        alert('Failed to update graph: ' + result.error);
      }
    } catch (error) {
      console.error('Error updating nx.json:', error);
      alert('Error updating nx.json: ' + (error as Error).message);
    }
  };

  const handleRestoreOriginal = async () => {
    try {
      const response = await fetch('/api/restore-nx-json', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Reload the original data
        window.location.reload();
      } else {
        console.error('Failed to restore original:', result.error);
        alert('Failed to restore original: ' + result.error);
      }
    } catch (error) {
      console.error('Error restoring original:', error);
      alert('Error restoring original: ' + (error as Error).message);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Nx Graph Diff Viewer</h1>
        <p>Visualize how changes to nx.json affect your project graph</p>
        <p className="warning">
          ⚠️ This tool modifies your actual nx.json file and regenerates the
          project graph. Use with caution!
        </p>
      </header>

      <div className="main-content">
        <div className="editor-section">
          <h2>nx.json Editor</h2>
          {nxJson && (
            <NxJsonEditor nxJson={nxJson} onUpdate={handleNxJsonUpdate} />
          )}
        </div>

        <div className="graph-section">
          <div className="graph-controls">
            <button
              onClick={() => setShowDiff(!showDiff)}
              disabled={!currentGraph || currentGraph === originalGraph}
            >
              {showDiff ? 'Hide Diff' : 'Show Diff'}
            </button>
            <button
              onClick={handleRestoreOriginal}
              className="restore-button"
              disabled={currentGraph === originalGraph}
            >
              Restore Original
            </button>
          </div>

          {originalGraph &&
            currentGraph &&
            (showDiff ? (
              <DiffViewer
                originalGraph={originalGraph}
                currentGraph={currentGraph}
              />
            ) : (
              <ProjectGraph graph={currentGraph} />
            ))}
        </div>
      </div>
    </div>
  );
}

export default App;
