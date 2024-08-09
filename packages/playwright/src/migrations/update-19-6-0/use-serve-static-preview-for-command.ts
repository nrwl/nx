import {
  createProjectGraphAsync,
  formatFiles,
  getPackageManagerCommand,
  joinPathFragments,
  parseTargetString,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import addE2eCiTargetDefaults from './add-e2e-ci-target-defaults';

export default async function (tree: Tree) {
  const graph = await createProjectGraphAsync();
  visitNotIgnoredFiles(tree, '', (path) => {
    if (!path.endsWith('playwright.config.ts')) {
      return;
    }

    let playwrightConfigFileContents = tree.read(path, 'utf-8');

    const WEBSERVER_COMMAND_SELECTOR =
      'PropertyAssignment:has(Identifier[name=webServer]) PropertyAssignment:has(Identifier[name=command]) > StringLiteral';
    let ast = tsquery.ast(playwrightConfigFileContents);
    const nodes = tsquery(ast, WEBSERVER_COMMAND_SELECTOR, {
      visitAllChildren: true,
    });
    if (!nodes.length) {
      return;
    }

    const commandValueNode = nodes[0];
    const command = commandValueNode.getText();
    let project: string;
    if (command.includes('nx run')) {
      const NX_TARGET_REGEX = "(?<=nx run )[^']+";
      const matches = command.match(NX_TARGET_REGEX);
      if (!matches) {
        return;
      }
      const targetString = matches[0];
      const parsedTargetString = parseTargetString(targetString, graph);

      if (
        parsedTargetString.target === 'serve-static' ||
        parsedTargetString.target === 'preview'
      ) {
        return;
      }

      project = parsedTargetString.project;
    } else {
      const NX_PROJECT_REGEX = "(?<=nx [^ ]+ )[^']+";
      const matches = command.match(NX_PROJECT_REGEX);
      if (!matches) {
        return;
      }
      project = matches[0];
    }

    const pathToViteConfig = [
      joinPathFragments(graph.nodes[project].data.root, 'vite.config.ts'),
      joinPathFragments(graph.nodes[project].data.root, 'vite.config.js'),
    ].find((p) => tree.exists(p));

    if (!pathToViteConfig) {
      const newCommand = `${
        getPackageManagerCommand().exec
      } nx run ${project}:serve-static`;
      tree.write(
        path,
        `${playwrightConfigFileContents.slice(
          0,
          commandValueNode.getStart()
        )}"${newCommand}"${playwrightConfigFileContents.slice(
          commandValueNode.getEnd()
        )}`
      );
    } else {
      const newCommand = `${
        getPackageManagerCommand().exec
      } nx run ${project}:preview`;
      tree.write(
        path,
        `${playwrightConfigFileContents.slice(
          0,
          commandValueNode.getStart()
        )}"${newCommand}"${playwrightConfigFileContents.slice(
          commandValueNode.getEnd()
        )}`
      );
      playwrightConfigFileContents = tree.read(path, 'utf-8');
      ast = tsquery.ast(playwrightConfigFileContents);

      const BASE_URL_SELECTOR =
        'VariableDeclaration:has(Identifier[name=baseURL])';
      const baseUrlNodes = tsquery(ast, BASE_URL_SELECTOR, {
        visitAllChildren: true,
      });
      if (!baseUrlNodes.length) {
        return;
      }

      const baseUrlNode = baseUrlNodes[0];
      const newBaseUrlVariableDeclaration =
        "baseURL = process.env['BASE_URL'] || 'http://localhost:4300';";
      tree.write(
        path,
        `${playwrightConfigFileContents.slice(
          0,
          baseUrlNode.getStart()
        )}${newBaseUrlVariableDeclaration}${playwrightConfigFileContents.slice(
          baseUrlNode.getEnd()
        )}`
      );

      playwrightConfigFileContents = tree.read(path, 'utf-8');
      ast = tsquery.ast(playwrightConfigFileContents);
      const WEB_SERVER_URL_SELECTOR =
        'PropertyAssignment:has(Identifier[name=webServer]) PropertyAssignment:has(Identifier[name=url]) > StringLiteral';
      const webServerUrlNodes = tsquery(ast, WEB_SERVER_URL_SELECTOR, {
        visitAllChildren: true,
      });
      if (!webServerUrlNodes.length) {
        return;
      }

      const webServerUrlNode = webServerUrlNodes[0];
      const newWebServerUrl = "'http://localhost:4300'";
      tree.write(
        path,
        `${playwrightConfigFileContents.slice(
          0,
          webServerUrlNode.getStart()
        )}${newWebServerUrl}${playwrightConfigFileContents.slice(
          webServerUrlNode.getEnd()
        )}`
      );
    }
  });

  await addE2eCiTargetDefaults(tree);
  await formatFiles(tree);
}
