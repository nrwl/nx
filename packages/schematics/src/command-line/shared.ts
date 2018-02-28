import { execSync } from 'child_process';
import * as path from 'path';
import {affectedApps, ProjectType, touchedProjects} from './affected-apps';
import * as fs from 'fs';

export function parseFiles(args: string[]): { files: string[]; rest: string[] } {
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

function getProjectNodes(config) {
  return (config.apps ? config.apps : []).filter(p => p.name !== '$workspaceRoot').map(p => {
    return {
      name: p.name,
      root: p.root,
      type: p.root.startsWith('apps/') ? ProjectType.app : ProjectType.lib,
      files: allFilesInDir(path.dirname(p.root))
    };
  });
}

export function getAffectedApps(touchedFiles: string[]): string[] {
  const config = JSON.parse(fs.readFileSync('.angular-cli.json', 'utf-8'));
  const projects = getProjectNodes(config);

  if (!config.project.npmScope) {
    throw new Error(`.angular-cli.json must define the npmScope property.`);
  }

  return affectedApps(config.project.npmScope, projects, f => fs.readFileSync(f, 'utf-8'), touchedFiles);
}

export function getTouchedProjects(touchedFiles: string[]): string[] {
  const config = JSON.parse(fs.readFileSync('.angular-cli.json', 'utf-8'));
  const projects = getProjectNodes(config);
  if (!config.project.npmScope) {
    throw new Error(`.angular-cli.json must define the npmScope property.`);
  }
  return touchedProjects(projects, touchedFiles).filter(p => !!p);
}

export function getProjectRoots(projectNames: string[]): string[] {
  const config = JSON.parse(fs.readFileSync('.angular-cli.json', 'utf-8'));
  const projects = getProjectNodes(config);
  return projectNames.map(name => path.dirname(projects.filter(p => p.name === name)[0].root));
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
