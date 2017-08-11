import {execSync} from 'child_process';

export function runCLI(command: string, {cwd}: {cwd?: string} = {}): string {
  cwd = cwd === undefined ? '' : cwd;
  return execSync(`../node_modules/.bin/ng ${command}`, {cwd: `./tmp/${cwd}`}).toString();
}
export function runSchematic(command: string, {cwd}: {cwd?: string} = {}): string {
  cwd = cwd === undefined ? '' : cwd;
  return execSync(`../../node_modules/.bin/schematics ${command}`, {cwd: `./tmp/${cwd}`}).toString();
}

// export function updateFile(f: string, content: string): void {
//   writeFileSync(path.join(files.getCwd(), 'tmp', f), content);
// }

// export function checkFilesExists(...expectedFiles: string[]) {
//   expectedFiles.forEach(f => {
//     const ff = f.startsWith('/') ? f : path.join(files.getCwd(), 'tmp', f);
//     if (! files.exists(ff)) {
//       throw new Error(`File '${ff}' does not exist`);
//     }
//   });
// }

// export function readFile(f: string) {
//   const ff = f.startsWith('/') ? f : path.join(files.getCwd(), 'tmp', f);
//   return readFileSync(ff).toString();
// }

export function cleanup() {
  execSync('rm -rf tmp && mkdir tmp');
}
