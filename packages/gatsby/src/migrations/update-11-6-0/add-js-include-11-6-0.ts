import { getProjects, Tree, updateJson } from '@nrwl/devkit';

export async function addJsInclude(host: Tree) {
  const projects = getProjects(host);

  projects.forEach((project) => {
    const tsconfigPath = `${project.root}/tsconfig.app.json`;

    if (project.targets?.build?.executor !== '@nrwl/gatsby:build') return;

    if (!host.exists(tsconfigPath)) return;

    updateJson(host, tsconfigPath, (json) => {
      if (!json.include) {
        json.include = [];
      }
      if (!json.exclude) {
        json.exclude = [];
      }
      json.include = uniq([...json.include, '**/*.js', '**/*.jsx']);
      json.exclude = uniq([...json.exclude, '**/*.spec.js', '**/*.spec.jsx']);
      return json;
    });
  });
}

const uniq = <T extends string[]>(value: T) => [...new Set(value)] as T;

export default addJsInclude;
