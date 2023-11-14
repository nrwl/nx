import {
  applyChangesToString,
  ChangeType,
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  StringChange,
  Tree,
} from '@nx/devkit';
import { CypressExecutorOptions } from '../../executors/cypress/cypress.impl';
import { forEachExecutorOptionsInGraph } from '@nx/devkit/src/generators/executor-options-utils';
import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isIdentifier,
  isObjectLiteralExpression,
  Node,
  ScriptTarget,
} from 'typescript';

function addDevServerTargets(
  tree: Tree,
  cypressConfig: string,
  devServerTargets: Record<string, string>
) {
  const contents = tree.read(cypressConfig, 'utf-8');

  const sourceFile = createSourceFile(
    cypressConfig,
    contents,
    ScriptTarget.ESNext
  );

  const ciDevServerTarget = devServerTargets.ci;
  delete devServerTargets.ci;

  const changes: StringChange[] = [];

  const visit = (node: Node) => {
    if (
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.text === 'nxE2EPreset'
    ) {
      const argumentContents =
        ', ' +
        JSON.stringify({
          devServerTargets,
          ciDevServerTarget,
        });
      if (node.arguments.length === 1) {
        changes.push({
          type: ChangeType.Insert,
          index: node.arguments[0].getEnd(),
          text: argumentContents,
        });
      } else {
        const lastArgument = node.arguments[node.arguments.length - 1];

        if (isObjectLiteralExpression(lastArgument)) {
          const lastProperty =
            lastArgument.properties[lastArgument.properties.length - 1];

          const trailingComma = lastArgument.properties.hasTrailingComma;

          changes.push({
            type: ChangeType.Insert,
            index: lastProperty.getEnd(),
            text:
              (trailingComma ? '' : ', ') +
              'devServerTargets: ' +
              JSON.stringify(devServerTargets) +
              (ciDevServerTarget
                ? `, ciDevServerTarget: '${ciDevServerTarget}'`
                : ''),
          });
        }
      }
    } else {
      forEachChild(node, visit);
    }
  };

  forEachChild(sourceFile, visit);

  tree.write(cypressConfig, applyChangesToString(contents, changes));
}

export default async function update(tree: Tree) {
  const projects = getProjects(tree);
  const graph = await createProjectGraphAsync();

  const devServerTargetsMap = new Map<string, Record<string, string>>();
  forEachExecutorOptionsInGraph<CypressExecutorOptions>(
    graph,
    '@nx/cypress:cypress',
    (options, project, target, configuration) => {
      const targetConfig = projects.get(project).targets?.[target];

      if (!targetConfig) {
        return;
      }

      const cypressConfig =
        options.cypressConfig ?? targetConfig.options?.cypressConfig;
      if (!cypressConfig) {
        return;
      }
      const devServerTargets: Record<string, string> = {};

      devServerTargets.default = targetConfig.options?.devServerTarget;
      for (const [configuration, configurationOptions] of Object.entries(
        targetConfig.configurations ?? {}
      )) {
        devServerTargets[configuration] = configurationOptions.devServerTarget;
      }

      devServerTargetsMap.set(cypressConfig, devServerTargets);
    }
  );

  for (const [cypressConfig, devServerTargets] of devServerTargetsMap) {
    addDevServerTargets(tree, cypressConfig, devServerTargets);
  }

  // const configFiles = glob(tree, [createNodes[0]]);
  //
  // const proj = Object.fromEntries(getProjects(tree).entries());
  //
  // const rootMappings = createProjectRootMappingsFromProjectConfigurations(proj);
  //
  // for (const configFile of configFiles) {
  //   const siblings = tree.children(dirname(configFile));
  //   if (!siblings.includes('project.json')) {
  //     continue;
  //   }
  //
  //   const projectName = findProjectForPath(configFile, rootMappings);
  //   const projectConfig = readProjectConfiguration(tree, projectName);
  //   const e2eTarget: TargetConfiguration<CypressExecutorOptions> =
  //     projectConfig.targets?.e2e;
  //
  //   if (!e2eTarget || e2eTarget.executor !== '@nx/cypress:cypress') {
  //     continue;
  //   }
  //
  //   nxMetadata.devServerTarget = e2eTarget.options?.devServerTarget;
  //   nxMetadata.productionDevServerTarget =
  //     e2eTarget.configurations?.production?.devServerTarget;
  //   nxMetadata.ciDevServerTarget =
  //     e2eTarget.configurations?.ci?.devServerTarget;
  //
  //   if (Object.values(nxMetadata).filter((v) => !!v).length > 0) {
  //     let contents = tree.read(configFile, 'utf-8');
  //
  //     contents =
  //       `import type { NxCypressMetadata } from '@nx/cypress/plugin';\n` +
  //       contents +
  //       `
  //
  //     /**
  //      * This is metadata for the @nx/cypress/plugin
  //      */
  //     export const nx: NxCypressMetadata = ${JSON.stringify(
  //       nxMetadata,
  //       null,
  //       2
  //     )};`;
  //
  //     tree.write(configFile, contents);
  //   }
  // }

  await formatFiles(tree);
}
