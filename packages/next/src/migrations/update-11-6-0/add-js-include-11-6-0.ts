import { getProjects, Tree, updateJson } from '@nrwl/devkit';

export async function addJsInclude(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((project) => {
    const tsconfigPath = `${project.root}/tsconfig.json`;

    if (project.targets?.build?.executor !== '@nrwl/next:build') return;

    if (!host.exists(tsconfigPath)) return;

    updateJson(host, tsconfigPath, (json) => {
      if (!json.include) {
        json.include = [];
      }
      json.include = uniq([...json.include, '**/*.js', '**/*.jsx']);
      return json;
    });
  });
}

const uniq = <T extends string[]>(value: T) => [...new Set(value)] as T;

export default addJsInclude;
