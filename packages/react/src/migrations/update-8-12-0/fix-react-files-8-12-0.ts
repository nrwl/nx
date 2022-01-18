import { chain, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  formatFiles,
  updateWorkspaceInTree,
} from '@nrwl/workspace';

export default function update(): Rule {
  return chain([
    updateWorkspaceInTree(updateBuilderWebpackOption),
    addDepsToPackageJson({}, { '@babel/preset-react': '7.8.3' }),
    formatFiles(),
  ]);
}

function updateBuilderWebpackOption(json) {
  Object.keys(json.projects).map((k) => {
    const p = json.projects[k];
    if (isReactProject(p) && !p.architect.build.options.webpackConfig) {
      p.architect.build.options.webpackConfig = '@nrwl/react/plugins/webpack';
    }
  });
  return json;
}

function isReactProject(p) {
  const buildArchitect =
    p.architect && p.architect.build ? p.architect.build : null;
  return (
    buildArchitect &&
    buildArchitect.builder === '@nrwl/web:build' &&
    buildArchitect.options.main.endsWith('.tsx')
  );
}
