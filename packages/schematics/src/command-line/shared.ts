import { execSync } from 'child_process';
import * as path from 'path';
import { affectedApps } from './affected-apps';
import * as fs from 'fs';

export function parseFiles(): { files: string[]; rest: string[] } {
  const args = process.argv.slice(3);

  let unnamed = [];
  let named = [];
  args.forEach(a => {
    if (a.startsWith('--') || a.startsWith('-')) {
      named.push(a);
    } else {
      unnamed.push(a);
    }
  });

  const dashDashFiles = named.filter(a => a.startsWith('--files='))[0];
  if (dashDashFiles) {
    named.splice(named.indexOf(dashDashFiles), 1);
    return { files: parseDashDashFiles(dashDashFiles), rest: [...unnamed, ...named] };
  } else if (unnamed.length >= 2) {
    return { files: getFilesFromShash(unnamed[0], unnamed[1]), rest: [...unnamed.slice(2), ...named] };
  } else {
    throw new Error('Invalid options provided');
  }
}

function parseDashDashFiles(dashDashFiles: string): string[] {
  let f = dashDashFiles.substring(8); // remove --files=
  if (f.startsWith('"') || f.startsWith("'")) {
    f = f.substring(1, f.length - 1);
  }
  return f.split(',').map(f => f.trim());
}

function getFilesFromShash(sha1: string, sha2: string): string[] {
  return execSync(`git diff --name-only ${sha1} ${sha2}`)
    .toString('utf-8')
    .split('\n')
    .map(a => a.trim())
    .filter(a => a.length > 0);
}

export function getAffectedApps(touchedFiles: string[]): string[] {
  const config = JSON.parse(fs.readFileSync('.angular-cli.json', 'utf-8'));
  const projects = (config.apps ? config.apps : []).map(p => {
    return {
      name: p.name,
      isApp: p.root.startsWith('apps/'),
      files: allFilesInDir(path.dirname(p.root))
    };
  });

  return affectedApps(config.project.npmScope, projects, f => fs.readFileSync(f, 'utf-8'), touchedFiles);
}

export function getAppRoots(appNames: string[]): string[] {
  const config = JSON.parse(fs.readFileSync('.angular-cli.json', 'utf-8'));
  return (config.apps ? config.apps : []).filter(p => appNames.indexOf(p.name) > -1).map(p => path.dirname(p.root));
}

function allFilesInDir(dirName: string): string[] {
  let res = [];
  fs.readdirSync(dirName).forEach(c => {
    const child = path.join(dirName, c);
    try {
      if (!fs.statSync(child).isDirectory()) {
        res.push(child);
      } else if (fs.statSync(child).isDirectory()) {
        res = [...res, ...allFilesInDir(child)];
      }
    } catch (e) {}
  });
  return res;
}
