import {
  chain,
  noop,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  readWorkspace,
  updateJsonInTree,
  updatePackagesInPackageJson,
  updateWorkspaceInTree,
} from '@nrwl/workspace';
import * as path from 'path';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { offsetFromRoot } from '@nrwl/devkit';

export default function update(): Rule {
  return chain([
    displayInformation,
    addCustomTypings,
    updateWorkspaceInTree(updateBuilderWebpackOption),
    updatePackagesInPackageJson(
      path.join(__dirname, '../../../', 'migrations.json'),
      '8.10.0'
    ),
  ]);
}

function displayInformation(host: Tree, context: SchematicContext) {
  context.logger.info(stripIndents`
  We've added SVG and SVGR support for React applications. If you are using this
  feature, please update your jest.config.js file(s) with the new transform.
  
  \`\`\`
  transform: {
    '^.+\\\\.[tj]sx?$': 'ts-jest',
    '^(?!.*\\\\.(js|jsx|ts|tsx|css|json)$)': '@nrwl/react/plugins/jest' // NEW!
  }
  \`\`\`
  `);
}

function addCustomTypings(host: Tree) {
  const workspace = readWorkspace(host);
  return chain([
    ...Object.keys(workspace.projects).map((k) => {
      const p = workspace.projects[k];
      if (p.projectType !== 'application') {
        return noop();
      }
      if (isReactProject(p)) {
        return updateJsonInTree(path.join(p.root, 'tsconfig.json'), (json) => {
          const files = json.files || [];
          files.push(
            `${offsetFromRoot(
              p.root
            )}node_modules/@nrwl/react/typings/cssmodule.d.ts`,
            `${offsetFromRoot(
              p.root
            )}node_modules/@nrwl/react/typings/image.d.ts`
          );
          json.files = files;
          return json;
        });
      } else {
        return noop();
      }
    }),
    formatFiles(),
  ]);
}

function updateBuilderWebpackOption(json) {
  Object.keys(json.projects).map((k) => {
    const p = json.projects[k];
    if (isReactProject(p)) {
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
    (buildArchitect.builder === '@nrwl/web:webpack' ||
      buildArchitect.builder === '@nrwl/web:build') &&
    (buildArchitect.options.webpackConfig === '@nrwl/react/plugins/babel' ||
      buildArchitect.options.webpackConfig === '@nrwl/react/plugins/webpack')
  );
}
