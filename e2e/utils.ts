import {execSync} from 'child_process';
import {readFileSync, statSync, writeFileSync} from 'fs';
import * as path from 'path';

const projectName:string = 'proj';

export function newApp(command?: string): string {
  return execSync(`../node_modules/.bin/ng new proj ${command}`, {cwd: `./tmp`}).toString();
}

export function runCLI(command?: string): string {
  return execSync(`../../node_modules/.bin/ng ${command}`, {cwd: `./tmp/${projectName}`}).toString();
}

export function runSchematic(command: string): string {
  return execSync(`../../node_modules/.bin/schematics ${command}`, {cwd: `./tmp/${projectName}`}).toString();
}

export function runCommand(command: string): string {
  return execSync(command, {cwd: `./tmp/${projectName}`}).toString();
}

export function updateFile(f: string, content: string): void {
  writeFileSync(path.join(getCwd(), 'tmp', 'proj', f), content);
}

export function checkFilesExists(...expectedFiles: string[]) {
  expectedFiles.forEach(f => {
    const ff = f.startsWith('/') ? f : path.join(getCwd(), 'tmp', projectName, f);
    if (!exists(ff)) {
      throw new Error(`File '${ff}' does not exist`);
    }
  });
}

export function readFile(f: string) {
  const ff = f.startsWith('/') ? f : path.join(getCwd(), 'tmp', projectName, f);
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

export function copyMissingPackages(): void {
  const modulesToCopy = [
    '@ngrx',
    'jasmine-marbles',
    '@nrwl',
    'angular',
    '@angular/upgrade',
  ];
  modulesToCopy.forEach(m => copyNodeModule(projectName, m));
}

function copyNodeModule(path: string, name: string) {
  execSync(`rm -rf tmp/${path}/node_modules/${name}`);
  execSync(`cp -r node_modules/${name} tmp/${path}/node_modules/${name}`);
}

export function addNodeModule(path: string, module: string): void {
  execSync(`cp -r node_modules/${module} tmp/${path}/node_modules/${module}`);
}
