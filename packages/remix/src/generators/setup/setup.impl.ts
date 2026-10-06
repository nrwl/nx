import {
  formatFiles,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nx/devkit';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { assertAndPinRemixTypescript } from '../../utils/assert-and-pin-remix-typescript';
import { assertSupportedRemixVersion } from '../../utils/versions';

export default async function (tree: Tree) {
  assertSupportedRemixVersion(tree);

  const tasks: GeneratorCallback[] = [];

  tasks.push(assertAndPinRemixTypescript(tree));

  const jsInitTask = await jsInitGenerator(tree, {
    skipFormat: true,
  });
  tasks.push(jsInitTask);

  // Ignore nested project files
  let ignoreFile = tree.read('.gitignore').toString();
  if (ignoreFile.indexOf('/dist') !== -1) {
    ignoreFile = ignoreFile.replace('/dist', 'dist');
  }
  if (ignoreFile.indexOf('/node_modules') !== -1) {
    ignoreFile = ignoreFile.replace('/node_modules', 'node_modules');
  }
  if (ignoreFile.indexOf('# Remix files') === -1) {
    ignoreFile = `${ignoreFile}
# Remix files
apps/**/build
apps/**/.cache
  `;
  }
  tree.write('.gitignore', ignoreFile);

  updateJson(tree, `package.json`, (json) => {
    json.type = 'module';
    return json;
  });

  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}
