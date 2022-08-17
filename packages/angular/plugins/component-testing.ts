import {
  ProjectGraph,
  createProjectGraphAsync,
  ProjectGraphDependency,
} from '@nrwl/devkit';
import { nxBaseCypressPreset } from '@nrwl/cypress/plugins/cypress-preset';

export function nxComponentTestingPreset(pathToConfig: string) {
  return {
    ...nxBaseCypressPreset(pathToConfig),
    devServer: {
      // cypress uses string union type,
      // need to use const to prevent typing to string
      framework: 'angular',
      bundler: 'webpack',
      // TODO(caleb): use project graph to get the correct ng config build path.
    } as const,
  };
}

async function getBuildConfig(projectPath: string) {
  console.log('creating graph');
  const pg = await createProjectGraphAsync();
  let projectName: string;

  for (const n in pg.nodes) {
    console.log(pg.nodes[n].data.root);
    if (pg.nodes[n].data.root === projectPath) {
      console.log('found name', pg.nodes[n].name);
      projectName = pg.nodes[n].name;
    }
  }

  if (!projectName) {
    console.log('oops didnt find project name in path', projectPath);
    return;
  }

  const project = pg.nodes[projectName];
  console.log('looking for build target');

  if (project.data.targets['build']) {
    console.log('project has build target', project.data.targets['build']);
  } else {
    const parents = findParentsOfProject(pg, projectName);
    if (parents.length === 0) {
      console.log('no build targets found in parents of project', projectName);
    } else {
      console.log('found build targets in parents of project', projectName);

      for (const parent of parents) {
        // TODO(caleb): how do I tell which is the "correct" one to use? i.e. which is the "closest" to our projectName?
        console.log(parent.source, pg.nodes[parent.source].data.targets);
      }
    }
  }
}

function findParentsOfProject(
  pg: ProjectGraph,
  projectName: string
): ProjectGraphDependency[] {
  const parents = [];
  for (const dep in pg.dependencies) {
    const f = pg.dependencies[dep].filter((d) => d.target === projectName);
    parents.push(...f);
  }
  return parents;
}
