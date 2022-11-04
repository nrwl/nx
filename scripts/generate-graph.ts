import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as yargs from 'yargs';
import { ensureDirSync, statSync } from 'fs-extra';

async function generateGraph(directory: string, name: string) {
  if (!existsSync(directory)) {
    console.error(`Could not find directory ${directory}`);
    return;
  }

  try {
    execSync(
      'npx nx graph --file ./node_modules/.cache/nx-graph-gen/graph.html',
      { cwd: directory, stdio: 'ignore' }
    );
  } catch {
    console.error(`Could not run graph command in directory ${directory}`);
    return;
  }
  const environmentJs = readFileSync(
    join(directory, 'node_modules/.cache/nx-graph-gen/static/environment.js'),
    { encoding: 'utf-8' }
  );

  const projectGraphResponse = environmentJs.match(
    /window.projectGraphResponse = (.*?);/
  );

  ensureDirSync(
    join(__dirname, '../graph/client/src/assets/generated-graphs/')
  );

  writeFileSync(
    join(
      __dirname,
      '../graph/client/src/assets/generated-graphs/',
      `${name}.json`
    ),
    projectGraphResponse[1]
  );
}

(async () => {
  const parsedArgs = yargs
    .scriptName('yarn generate-graph')
    .strictOptions()
    .option('name', {
      type: 'string',
      requiresArg: true,
      description:
        'The version to publish. This does not need to be passed and can be inferred.',
    })
    .option('directory', {
      type: 'string',
      requiresArg: true,
      description: 'Directory of workspace',
    })
    .parseSync();

  generateGraph(parsedArgs.directory, parsedArgs.name);
})();
