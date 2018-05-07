import { execSync } from 'child_process';
import {
  getAffectedApps,
  getAffectedE2e,
  getAffectedProjects,
  parseFiles,
  readDepGraph
} from './shared';
import * as path from 'path';
import * as resolve from 'resolve';
import * as runAll from 'npm-run-all';
import * as yargsParser from 'yargs-parser';
import { generateGraph } from './dep-graph';
import {
  DepGraph,
  ProjectNode,
  ProjectType
} from '@nrwl/schematics/src/command-line/affected-apps';

export function affected(args: string[]): void {
  const command = args[0];
  let apps: string[];
  let e2eProjects: string[];
  let projects: string[];
  let rest: string[];

  try {
    const p = parseFiles(args.slice(1));
    rest = p.rest;
    apps = getAffectedApps(p.files);
    e2eProjects = getAffectedE2e(p.files);
    projects = getAffectedProjects(p.files);
  } catch (e) {
    printError(command, e);
    process.exit(1);
  }

  switch (command) {
    case 'apps':
      console.log(apps.join(' '));
      break;
    case 'build':
      build(apps, rest);
      break;
    case 'test':
      test(projects, rest);
      break;
    case 'e2e':
      e2e(e2eProjects, rest);
      break;
    case 'dep-graph':
      generateGraph(yargsParser(rest), projects);
      break;
  }
}

function printError(command: string, e: any) {
  console.error(e.message);
}

function build(apps: string[], rest: string[]) {
  if (apps.length > 0) {
    console.log(`Building ${apps.join(', ')}`);
    runCommand(
      'build',
      apps,
      rest,
      'Building ',
      'Build succeeded.',
      'Build failed.'
    );
  } else {
    console.log('No apps to build');
  }
}

function test(projects: string[], rest: string[]) {
  const depGraph = readDepGraph();
  const sortedProjects = topologicallySortProjects(depGraph);
  const sortedAffectedProjects = sortedProjects.filter(
    pp => projects.indexOf(pp) > -1
  );
  const projectsToTest = sortedAffectedProjects.filter(
    p => depGraph.projects.find(pp => pp.name === p).type !== ProjectType.e2e
  );

  if (projectsToTest.length > 0) {
    console.log(`Testing ${projectsToTest.join(', ')}`);
    runCommand(
      'test',
      projectsToTest,
      rest,
      'Testing ',
      'Tests passed.',
      'Tests failed.'
    );
  } else {
    console.log('No projects to test');
  }
}

function runCommand(
  command: string,
  projects: string[],
  args: string[],
  iterationMessage: string,
  successMessage: string,
  errorMessage: string
) {
  const parallel = yargsParser(args, {
    default: {
      parallel: false
    },
    boolean: ['parallel']
  }).parallel;

  const normalizedArgs = args.filter(
    a => !a.startsWith('--parallel') && !a.startsWith('--no-parallel')
  );
  if (parallel) {
    runAll(
      projects.map(
        app => `ng ${command} -- ${normalizedArgs.join(' ')} --project=${app}`
      ),
      {
        parallel,
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr
      }
    )
      .then(() => console.log(successMessage))
      .catch(err => console.error(errorMessage));
  } else {
    projects.forEach(project => {
      console.log(iterationMessage + project);
      execSync(
        `node ${ngPath()} ${command} ${normalizedArgs.join(
          ' '
        )} --project=${project}`,
        {
          stdio: [0, 1, 2]
        }
      );
    });
  }
}

function topologicallySortProjects(deps: DepGraph): string[] {
  const temporary = {};
  const marked = {};
  const res = [];

  while (Object.keys(marked).length !== deps.projects.length) {
    visit(deps.projects.find(p => !marked[p.name]));
  }

  function visit(n: ProjectNode) {
    if (marked[n.name]) return;
    if (temporary[n.name]) return;
    temporary[n.name] = true;
    deps.deps[n.name].forEach(e => {
      visit(deps.projects.find(pp => pp.name === e.projectName));
    });
    marked[n.name] = true;
    res.push(n.name);
  }

  return res;
}

function e2e(apps: string[], rest: string[]) {
  if (apps.length > 0) {
    console.log(`Testing ${apps.join(', ')}`);
    apps.forEach(app => {
      execSync(`node ${ngPath()} e2e ${rest.join(' ')} --project=${app}`, {
        stdio: [0, 1, 2]
      });
    });
  } else {
    console.log('No apps to test');
  }
}

function ngPath() {
  const basePath = path.dirname(
    path.dirname(
      path.dirname(resolve.sync('@angular/cli', { basedir: __dirname }))
    )
  );
  return path.join(basePath, 'bin', 'ng');
}
