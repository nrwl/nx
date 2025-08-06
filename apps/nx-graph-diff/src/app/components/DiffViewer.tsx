import React, { useMemo, useState } from 'react';
import deepEqual from 'deep-equal';
import './DiffViewer.css';

interface DiffViewerProps {
  originalGraph: any;
  currentGraph: any;
}

interface Change {
  type: 'added' | 'removed' | 'modified';
  projectName: string;
  targetName?: string;
  details: string;
  originalValue?: any;
  currentValue?: any;
  property?: string;
}

const DiffViewer: React.FC<DiffViewerProps> = ({
  originalGraph,
  currentGraph,
}) => {
  const [showDetailedDiff, setShowDetailedDiff] = useState(true);
  const changes = useMemo(() => {
    const changesList: Change[] = [];

    // Compare projects
    const originalProjects =
      originalGraph?.graph?.nodes || originalGraph?.nodes || {};
    const currentProjects =
      currentGraph?.graph?.nodes || currentGraph?.nodes || {};

    // Check for removed projects
    Object.keys(originalProjects).forEach((projectName) => {
      if (!currentProjects[projectName]) {
        changesList.push({
          type: 'removed',
          projectName,
          details: 'Project removed',
        });
      }
    });

    // Check for added projects and modified projects
    Object.keys(currentProjects).forEach((projectName) => {
      if (!originalProjects[projectName]) {
        changesList.push({
          type: 'added',
          projectName,
          details: 'Project added',
        });
      } else {
        // Check for modified targets
        const originalTargets =
          originalProjects[projectName].data.targets || {};
        const currentTargets = currentProjects[projectName].data.targets || {};

        // Check for removed targets
        Object.keys(originalTargets).forEach((targetName) => {
          if (!currentTargets[targetName]) {
            changesList.push({
              type: 'removed',
              projectName,
              targetName,
              details: `Target "${targetName}" removed`,
            });
          }
        });

        // Check for added or modified targets
        Object.keys(currentTargets).forEach((targetName) => {
          if (!originalTargets[targetName]) {
            changesList.push({
              type: 'added',
              projectName,
              targetName,
              details: `Target "${targetName}" added`,
            });
          } else if (
            !deepEqual(originalTargets[targetName], currentTargets[targetName])
          ) {
            const changes = [];

            // Check specific changes and create detailed change entries
            const propertiesToCheck = [
              { key: 'dependsOn', label: 'dependencies' },
              { key: 'inputs', label: 'inputs' },
              { key: 'outputs', label: 'outputs' },
              { key: 'cache', label: 'cache settings' },
              { key: 'options', label: 'options' },
              { key: 'executor', label: 'executor' },
            ];

            const changedProperties: string[] = [];

            propertiesToCheck.forEach(({ key, label }) => {
              const originalValue = originalTargets[targetName][key];
              const currentValue = currentTargets[targetName][key];

              if (!deepEqual(originalValue, currentValue)) {
                changedProperties.push(label);

                // Create detailed change entry
                changesList.push({
                  type: 'modified',
                  projectName,
                  targetName,
                  property: key,
                  details: `Target "${targetName}" ${label} changed`,
                  originalValue,
                  currentValue,
                });
              }
            });

            // Create summary entry if there are changes
            if (changedProperties.length > 0) {
              changesList.push({
                type: 'modified',
                projectName,
                targetName,
                details: `Target "${targetName}" modified: ${changedProperties.join(
                  ', '
                )}`,
              });
            }
          }
        });
      }
    });

    return changesList;
  }, [originalGraph, currentGraph]);

  const groupedChanges = useMemo(() => {
    const grouped: { [key: string]: Change[] } = {};

    changes.forEach((change) => {
      if (!grouped[change.projectName]) {
        grouped[change.projectName] = [];
      }
      grouped[change.projectName].push(change);
    });

    return grouped;
  }, [changes]);

  // Filter changes based on detailed view setting
  const displayChanges = useMemo(() => {
    if (showDetailedDiff) {
      return changes.filter((change) => change.property); // Only detailed changes
    } else {
      return changes.filter((change) => !change.property); // Only summary changes
    }
  }, [changes, showDetailedDiff]);

  const groupedDisplayChanges = useMemo(() => {
    const grouped: { [key: string]: Change[] } = {};

    displayChanges.forEach((change) => {
      if (!grouped[change.projectName]) {
        grouped[change.projectName] = [];
      }
      grouped[change.projectName].push(change);
    });

    return grouped;
  }, [displayChanges]);

  const renderValue = (value: any) => {
    if (Array.isArray(value)) {
      return (
        <div className="array-value">
          {value.map((item, index) => (
            <div key={index} className="array-item">
              {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
            </div>
          ))}
        </div>
      );
    }
    return typeof value === 'object'
      ? JSON.stringify(value, null, 2)
      : String(value);
  };

  return (
    <div className="diff-viewer">
      <div className="diff-header">
        <h3>Changes ({changes.filter((c) => !c.property).length})</h3>
        <button
          className="toggle-detailed"
          onClick={() => setShowDetailedDiff(!showDetailedDiff)}
        >
          {showDetailedDiff ? 'Show Summary' : 'Show Detailed'}
        </button>
      </div>

      {changes.length === 0 ? (
        <p className="no-changes">No changes detected</p>
      ) : (
        <div className="changes-list">
          {Object.entries(groupedDisplayChanges).map(
            ([projectName, projectChanges]) => (
              <div key={projectName} className="project-changes">
                <h4>{projectName}</h4>
                <ul className="change-items">
                  {projectChanges.map((change, index) => (
                    <li
                      key={index}
                      className={`change-item ${change.type} ${
                        showDetailedDiff ? 'detailed' : ''
                      }`}
                    >
                      <div className="change-summary">
                        <span className="change-type">
                          {change.type === 'added' && '+ '}
                          {change.type === 'removed' && '- '}
                          {change.type === 'modified' && '~ '}
                        </span>
                        <span className="change-details">{change.details}</span>
                      </div>

                      {showDetailedDiff && change.property && (
                        <div className="change-diff">
                          <div className="diff-section">
                            <h6>Before:</h6>
                            <div className="value-display original">
                              {change.originalValue ? (
                                renderValue(change.originalValue)
                              ) : (
                                <em>undefined</em>
                              )}
                            </div>
                          </div>
                          <div className="diff-section">
                            <h6>After:</h6>
                            <div className="value-display current">
                              {change.currentValue ? (
                                renderValue(change.currentValue)
                              ) : (
                                <em>undefined</em>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default DiffViewer;
