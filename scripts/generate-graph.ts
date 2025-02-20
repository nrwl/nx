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
      { cwd: directory, stdio: 'ignore', windowsHide: false }
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

  const taskGraphResponse = environmentJs.match(
    /window.taskGraphResponse = (.*?);/
  );

  const expandedTaskInputsReponse = environmentJs.match(
    /window.expandedTaskInputsResponse = (.*?);/
  );

  const sourceMapsResponse = environmentJs.match(
    /window.sourceMapsResponse = (.*?);/
  );

  ensureDirSync(
    join(__dirname, '../graph/client/src/assets/generated-project-graphs/')
  );
  ensureDirSync(
    join(__dirname, '../graph/client/src/assets/generated-task-graphs/')
  );
  ensureDirSync(
    join(__dirname, '../graph/client/src/assets/generated-task-inputs/')
  );
  ensureDirSync(
    join(__dirname, '../graph/client/src/assets/generated-source-maps/')
  );

  writeFileSync(
    join(
      __dirname,
      '../graph/client/src/assets/generated-project-graphs/',
      `${name}.json`
    ),
    projectGraphResponse[1]
  );

  writeFileSync(
    join(
      __dirname,
      '../graph/client/src/assets/generated-task-graphs/',
      `${name}.json`
    ),
    taskGraphResponse[1]
  );

  writeFileSync(
    join(
      __dirname,
      '../graph/client/src/assets/generated-task-inputs/',
      `${name}.json`
    ),
    expandedTaskInputsReponse[1]
  );

  writeFileSync(
    join(
      __dirname,
      '../graph/client/src/assets/generated-source-maps/',
      `${name}.json`
    ),
    sourceMapsResponse[1]
  );
}

(async () => {
  const parsedArgs = yargs
    .scriptName('pnpm generate-graph')
    .strictOptions()
    .option('name', {
      type: 'string',
      requiresArg: true,
      description: 'The snake-case name of the file created',
    })
    .option('directory', {
      type: 'string',
      requiresArg: true,
      description: 'Directory of workspace',
    })
    .parseSync();

  await generateGraph(parsedArgs.directory, parsedArgs.name);
})();
