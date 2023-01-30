import { execSync } from 'child_process';
import {
  chmodSync,
  readFileSync,
  writeFileSync,
  constants as FsConstants,
} from 'fs';
import { join } from 'path';
import { valid } from 'semver';
import { NxJsonConfiguration } from '../config/nx-json';
import { writeJsonFile } from '../utils/fileutils';

export function writeMinimalNxJson(version: string) {
  if (!valid(version)) {
    version = execSync(`npm view nx@${version} version`).toString();
  }
  writeJsonFile<NxJsonConfiguration>(join(process.cwd(), 'nx.json'), {
    tasksRunnerOptions: {
      default: {
        runner: 'nx/tasks-runners/default',
        options: {
          cacheableOperations: [],
        },
      },
    },
    installation: {
      version: version.trimEnd(),
    },
  });
}

export function writeNxSH() {
  const lines = [
    '#!/bin/bash',
    `script="${getNodeScriptContents()}"`,
    'node -e "$script"',
    'node .nx/installation/node_modules/nx/bin/nx.js $@',
  ].join('\n');
  writeFileSync(join(process.cwd(), 'nx'), lines);
  chmodSync(
    'nx',
    FsConstants.S_IXUSR | FsConstants.S_IRUSR | FsConstants.S_IWUSR
  );
}

export function writeNxBat() {
  const lines = [
    '#!/bin/bash',
    `set script="${getNodeScriptContents()}"`,
    'node -e "$script"',
    'node .nx/installation/node_modules/nx/bin/nx.js %*',
  ].join('\n');
  writeFileSync('nx.bat', lines);
}

function getNodeScriptContents() {
  return readFileSync(join(__dirname, 'nx-sh-bat.js'), 'utf-8').replace(
    /"/g,
    "'"
  );
}

writeNxSH();
