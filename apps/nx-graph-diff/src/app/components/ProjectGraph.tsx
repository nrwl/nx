import React from 'react';
import './ProjectGraph.css';

interface ProjectGraphProps {
  graph: any;
}

const ProjectGraph: React.FC<ProjectGraphProps> = ({ graph }) => {
  const projects = Object.entries(graph?.graph?.nodes || graph?.nodes || {});

  return (
    <div className="project-graph">
      <h3>Projects ({projects.length})</h3>
      <div className="projects-list">
        {projects.map(([name, project]: [string, any]) => (
          <div key={name} className="project-card">
            <h4>{name}</h4>
            <div className="project-info">
              <p>
                <strong>Type:</strong> {project.type}
              </p>
              <p>
                <strong>Root:</strong> {project.data.root}
              </p>
              {project.data.tags && project.data.tags.length > 0 && (
                <p>
                  <strong>Tags:</strong> {project.data.tags.join(', ')}
                </p>
              )}
            </div>

            {project.data.targets &&
              Object.keys(project.data.targets).length > 0 && (
                <div className="targets">
                  <h5>Targets:</h5>
                  <ul>
                    {Object.entries(project.data.targets).map(
                      ([targetName, target]: [string, any]) => (
                        <li key={targetName} className="target-item">
                          <div className="target-header">
                            <strong>{targetName}</strong>
                            {target.executor && (
                              <span className="executor">
                                {' '}
                                ({target.executor})
                              </span>
                            )}
                          </div>

                          <div className="target-details">
                            {target.dependsOn &&
                              target.dependsOn.length > 0 && (
                                <div className="target-property">
                                  <span className="property-label">
                                    Depends on:
                                  </span>
                                  <span className="property-value">
                                    {target.dependsOn.join(', ')}
                                  </span>
                                </div>
                              )}

                            {target.inputs && target.inputs.length > 0 && (
                              <div className="target-property">
                                <span className="property-label">Inputs:</span>
                                <div className="property-list">
                                  {target.inputs.map(
                                    (input: any, index: number) => (
                                      <div key={index} className="input-item">
                                        {typeof input === 'string'
                                          ? input
                                          : JSON.stringify(input, null, 2)}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {target.outputs && target.outputs.length > 0 && (
                              <div className="target-property">
                                <span className="property-label">Outputs:</span>
                                <div className="property-list">
                                  {target.outputs.map(
                                    (output: string, index: number) => (
                                      <div key={index} className="output-item">
                                        {output}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {target.cache !== undefined && (
                              <div className="target-property">
                                <span className="property-label">Cache:</span>
                                <span
                                  className={`cache-value ${
                                    target.cache ? 'enabled' : 'disabled'
                                  }`}
                                >
                                  {target.cache ? 'enabled' : 'disabled'}
                                </span>
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectGraph;
