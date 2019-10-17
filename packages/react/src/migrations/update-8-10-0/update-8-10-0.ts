import {
  chain,
  noop,
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import {
  offsetFromRoot,
  readWorkspace,
  updateJsonInTree,
  updatePackagesInPackageJson
} from '@nrwl/workspace';
import * as path from 'path';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

const ignore = require('ignore');

export default function update(): Rule {
  return chain([
    displayInformation,
    addCustomTypings,
    updatePackagesInPackageJson(
      path.join(__dirname, '../../../', 'migrations.json'),
      '8.10.0'
    )
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
  return chain(
    Object.keys(workspace.projects).map(k => {
      const p = workspace.projects[k];
      if (p.projectType !== 'application') {
        return noop();
      }
      const buildArchitect =
        p.architect && p.architect.build ? p.architect.build : null;
      if (
        buildArchitect &&
        buildArchitect.builder === '@nrwl/web:build' &&
        buildArchitect.options.webpackConfig === '@nrwl/react/plugins/babel'
      ) {
        return updateJsonInTree(path.join(p.root, 'tsconfig.json'), json => {
          const files = json.files || [];
          files.push(
            `${offsetFromRoot(p.root)}node_modules/@nrwl/react/typings/svg.d.ts`
          );
          json.files = files;
          return json;
        });
      } else {
        return noop();
      }
    })
  );
}
