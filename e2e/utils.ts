import {execSync} from 'child_process';
import {linkSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync} from 'fs';
import * as path from 'path';

const projectName: string = 'proj';

export function ngNew(command?: string): string {
  return execSync(`../node_modules/.bin/ng new proj ${command}`, {cwd: `./tmp`}).toString();
}

export function ngNewBazel(command?: string): string {
  const res = ngNew(command);
  const cliPath = path.join('tmp', projectName, 'node_modules', '@angular', 'cli');
  execSync(`rm -rf ${cliPath}`);
  execSync(`cp -r node_modules/clis/bazel ${cliPath}`);
  return res;
}

export function runCLI(command?: string, opts = {
  silenceError: false
}): string {
  try {
    return execSync(`../../node_modules/.bin/ng ${command}`, {cwd: `./tmp/${projectName}`})
        .toString()
        .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  } catch (e) {
    if (opts.silenceError) {
      return e.stdout.toString();
    } else {
      console.log(e);
      throw e;
    }
  }
}

// switch to ng generate, once CLI is fixed
export function newApp(name: string): string {
  return runCLI(`generate app ${name}`)
  // return execSync(`../../node_modules/.bin/schematics @nrwl/schematics:app --name=${name}
  // --collection=@nrwl/schematics`, { cwd: `./tmp/${projectName}` }).toString();
}

// switch to ng generate, once CLI is fixed
export function newLib(name: string): string {
  return runCLI(`generate lib ${name}`)
  // return execSync(`../../node_modules/.bin/schematics @nrwl/schematics:lib --name=${name}
  // --collection=@nrwl/schematics`, { cwd: `./tmp/${projectName}` }).toString();
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

export function checkFilesExist(...expectedFiles: string[]) {
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
  const modulesToCopy = ['@ngrx', 'jasmine-marbles', '@nrwl', 'angular', '@angular/upgrade', '@angular/cli'];
  modulesToCopy.forEach(m => copyNodeModule(projectName, m));
}

function copyNodeModule(path: string, name: string) {
  execSync(`rm -rf tmp/${path}/node_modules/${name}`);
  execSync(`cp -r node_modules/${name} tmp/${path}/node_modules/${name}`);
}
