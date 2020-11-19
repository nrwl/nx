import { parseRunOneOptions } from './parse-run-one-options';
import { findWorkspaceRoot } from './find-workspace-root';
import * as fs from 'fs';
import * as path from 'path';
import {
  WorkspaceDefinition,
  Workspaces,
} from '@nrwl/tao/src/shared/workspace';

const ws = new Workspaces();
export function useNxToRunNxBuilderOrSchematic() {
  try {
    const dir = findWorkspaceRoot(__dirname).dir;
    const args = process.argv.slice(2);
    const wd = ws.readWorkspaceConfiguration(dir);
    return isNxBuilder(dir, args, wd) || isNxSchematic(dir, args, wd);
  } catch (e) {
    return false;
  }
}

function isNxBuilder(dir: string, args: string[], wd: WorkspaceDefinition) {
  try {
    const angularJsonPath = path.join(dir, 'angular.json');
    const angularJson = JSON.parse(fs.readFileSync(angularJsonPath).toString());
    const runOpts = parseRunOneOptions(angularJson, args);
    if (runOpts === false) return false;
    return ws.isNxBuilder(
      wd.projects[runOpts.project].architect[runOpts.target]
    );
  } catch (e) {
    return false;
  }
}

function isNxSchematic(dir: string, args: string[], wd: WorkspaceDefinition) {
  try {
    if (args[0] != 'g' && args[0] != 'generate') return false;
    const defaultCollection = wd.cli ? wd.cli.defaultCollection : null;

    let [collectionName, schematicName] = args[1].split(':');
    if (!schematicName) {
      schematicName = collectionName;
      collectionName = defaultCollection;
    }
    return ws.isNxSchematic(collectionName, schematicName);
  } catch (e) {
    return false;
  }
}
