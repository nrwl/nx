/*
 * This plugin updates the project graph so dependencies to internal packages
 * are rewritten to their npm counterparts since that is where we actually
 * import from.
 */
exports.processProjectGraph = (graph, { workspace }) => {
  const nrwlPlugins = Object.keys(workspace.projects).filter((name) => {
    const p = workspace.projects[name];
    return !p.tags || !p.tags.includes('scope:nx-dev');
  });
  Object.keys(graph.dependencies).forEach((name) => {
    if (!name.startsWith('nx-dev')) return;

    const deps = graph.dependencies[name];

    deps.forEach((dep) => {
      if (nrwlPlugins.includes(dep.target)) {
        dep.target = `npm:@nrwl/${dep.target}`;
      }
    });
  });

  return graph;
};
