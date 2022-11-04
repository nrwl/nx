import * as yargs from 'yargs';
import { ensureDirSync } from 'fs-extra';
import { join } from 'path';
import { writeFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';

function generateFileContent(
  projects: { id: string; label: string; url: string }[]
) {
  return `
  window.exclude = [];
window.watch = false;
window.environment = 'dev';
window.useXstateInspect = false;

window.appConfig = {
  showDebugger: true,
  showExperimentalFeatures: true,
  projectGraphs: ${JSON.stringify(projects)},
  defaultProjectGraph: '${projects[0].id}',
};

  `;
}

function writeFile() {
  let generatedGraphs;
  try {
    generatedGraphs = readdirSync(
      join(__dirname, '../graph/client/src/assets/generated-graphs')
    ).map((filename) => {
      const id = filename.substring(0, filename.length - 5);
      return {
        id,
        label: id,
        url: join('assets/generated-graphs/', filename),
      };
    });
  } catch {
    generatedGraphs = [];
  }

  let pregeneratedGraphs;
  try {
    pregeneratedGraphs = readdirSync(
      join(__dirname, '../graph/client/src/assets/graphs')
    ).map((filename) => {
      const id = filename.substring(0, filename.length - 5);
      return {
        id,
        label: id,
        url: join('assets/graphs/', filename),
      };
    });
  } catch {
    pregeneratedGraphs = [];
  }

  // if no generated projects are found, generate one for nx and try this again
  if (generatedGraphs.length === 0) {
    execSync('nx run graph-client:generate-graph --directory ./ --name nx');
    writeFile();
    return;
  }

  const projects = generatedGraphs.concat(pregeneratedGraphs);

  ensureDirSync(join(__dirname, '../graph/client/src/assets/dev/'));

  writeFileSync(
    join(__dirname, '../graph/client/src/assets/dev/', `environment.js`),
    generateFileContent(projects)
  );
}

writeFile();
