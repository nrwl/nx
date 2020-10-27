import { parseRunOneOptions } from './parse-run-one-options';
import { findWorkspaceRoot, isNxBuilder } from './find-workspace-root';
import * as fs from 'fs';
import * as path from 'path';

export function isRunningNxBuilder() {
  try {
    const dir = findWorkspaceRoot(__dirname).dir;
    const angularJsonPath = path.join(dir, 'angular.json');
    const angularJson = JSON.parse(fs.readFileSync(angularJsonPath).toString());
    const runOpts = parseRunOneOptions(angularJson, process.argv.slice(2));
    if (runOpts === false) return false;
    return isNxBuilder(angularJsonPath, runOpts.project, runOpts.target);
  } catch (e) {
    return false;
  }
}
