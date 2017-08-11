import {execSync} from 'child_process';
import * as path from 'path';
import {readFileSync, statSync, writeFileSync} from 'fs';

export function newApp(command: string): string {
  return execSync(`../node_modules/.bin/ng ${command}`, {cwd: `./tmp`}).toString();
}
export function runCLI(command: string, {cwd}: {cwd: string}): string {
  cwd = cwd === undefined ? '' : cwd;
  return execSync(`../../node_modules/.bin/ng ${command}`, {cwd: `./tmp/${cwd}`}).toString();
}
export function runSchematic(command: string, {cwd}: {cwd: string}): string {
  cwd = cwd === undefined ? '' : cwd;
  return execSync(`../../node_modules/.bin/schematics ${command}`, {cwd: `./tmp/${cwd}`}).toString();
}
export function runCommand(command: string, {cwd}: {cwd: string}): string {
  cwd = cwd === undefined ? '' : cwd;
  return execSync(command, {cwd: `./tmp/${cwd}`}).toString();
}

export function updateFile(f: string, content: string): void {
  writeFileSync(path.join(getCwd(), 'tmp', f), content);
}

export function checkFilesExists(...expectedFiles: string[]) {
  expectedFiles.forEach(f => {
    const ff = f.startsWith('/') ? f : path.join(getCwd(), 'tmp', f);
    if (! exists(ff)) {
      throw new Error(`File '${ff}' does not exist`);
    }
  });
}

export function readFile(f: string) {
  const ff = f.startsWith('/') ? f : path.join(getCwd(), 'tmp', f);
  return readFileSync(ff).toString();
}

export function cleanup() {
  execSync('rm -rf tmp && mkdir tmp');
}

export function getCwd(): string {
  return process.cwd();
}

export function directoryExists(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory();
  } catch (err) {
    return false;
  }
}

export function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

export function exists(filePath: string): boolean {
  return directoryExists(filePath) || fileExists(filePath);
}

export function addNgRx(path: string): string {
  const p = JSON.parse(readFile(`${path}/package.json`));
  p['dependencies']['@ngrx/store'] = '4.0.2';
  p['dependencies']['@ngrx/effects'] = '4.0.2';
  p['dependencies']['jasmine-marbles'] = '0.1.0';
  updateFile(`${path}/package.json`, JSON.stringify(p, null, 2));
  return runCommand('npm install', {cwd: path});
}
