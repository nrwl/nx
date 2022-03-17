import { removeSync } from 'fs-extra';
import * as fs from 'fs';

export function cleanUpFiles(appName: string) {
  // Delete targets from project since we delegate to npm scripts.
  const data = fs.readFileSync(`apps/${appName}/project.json`);
  const json = JSON.parse(data.toString());
  delete json.targets;
  fs.writeFileSync(
    `apps/${appName}/project.json`,
    JSON.stringify(json, null, 2)
  );

  removeSync('temp-workspace');
  removeSync('workspace.json');
}
