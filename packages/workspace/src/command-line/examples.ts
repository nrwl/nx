export interface Example {
  command: string;
  description: string;
}

export const examples: Record<string, Example[]> = {
  'print-affected': [
    {
      command: 'print-affected',
      description:
        'Print information about affected projects and the dependency graph',
    },
    {
      command: 'print-affected --base=main --head=HEAD',
      description:
        'Print information about the projects affected by the changes between main and HEAD (e.g,. PR)',
    },
    {
      command: 'print-affected --target=test',
      description:
        'Prints information about the affected projects and a list of tasks to test them',
    },
    {
      command: 'print-affected --target=build --select=projects',
      description:
        'Prints the projects property from the print-affected output',
    },
    {
      command: 'print-affected --target=build --select=tasks.target.project',
      description:
        'Prints the tasks.target.project property from the print-affected output',
    },
  ],
  affected: [
    {
      command: 'affected --target=custom-target',
      description: 'Run custom target for all affected projects',
    },
    {
      command: 'affected --target=test --parallel=5',
      description: 'Run tests in parallel',
    },
    {
      command: 'affected --target=test --only-failed',
      description:
        'Rerun the test target only for the projects that failed last time',
    },
    {
      command: 'affected --target=test --all',
      description: 'Run the test target for all projects',
    },
    {
      command: 'affected --target=test --files=libs/mylib/src/index.ts',
      description:
        'Run tests for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected --target=test --base=main --head=HEAD',
      description:
        'Run tests for all the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected --target=test --base=main~1 --head=main',
      description:
        'Run tests for all the projects affected by the last commit on main',
    },
  ],
  'affected:test': [
    {
      command: 'affected:test --parallel=5',
      description: 'Run tests in parallel',
    },
    {
      command: 'affected:test --only-failed',
      description:
        'Rerun the test target only for the projects that failed last time',
    },
    {
      command: 'affected:test --all',
      description: 'Run the test target for all projects',
    },
    {
      command: 'affected:test --files=libs/mylib/src/index.ts',
      description:
        'Run tests for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:test --base=main --head=HEAD',
      description:
        'Run tests for all the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:test --base=main~1 --head=main',
      description:
        'Run tests for all the projects affected by the last commit on main',
    },
  ],
  'affected:build': [
    {
      command: 'affected:build --parallel=5',
      description: 'Run build in parallel',
    },
    {
      command: 'affected:build --only-failed',
      description:
        'Rerun the build target only for the projects that failed last time',
    },
    {
      command: 'affected:build --all',
      description: 'Run the build target for all projects',
    },
    {
      command: 'affected:build --files=libs/mylib/src/index.ts',
      description:
        'Run build for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:build --base=main --head=HEAD',
      description:
        'Run build for all the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:build --base=main~1 --head=main',
      description:
        'Run build for all the projects affected by the last commit on main',
    },
  ],
  'affected:e2e': [
    {
      command: 'affected:e2e --parallel=5',
      description: 'Run tests in parallel',
    },
    {
      command: 'affected:e2e --only-failed',
      description:
        'Rerun the test target only for the projects that failed last time',
    },
    {
      command: 'affected:e2e --all',
      description: 'Run the test target for all projects',
    },
    {
      command: 'affected:e2e --files=libs/mylib/src/index.ts',
      description:
        'Run tests for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:e2e --base=main --head=HEAD',
      description:
        'Run tests for all the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:e2e --base=main~1 --head=main',
      description:
        'Run tests for all the projects affected by the last commit on main',
    },
  ],
  'affected:lint': [
    {
      command: 'affected:lint --parallel=5',
      description: 'Run lint in parallel',
    },
    {
      command: 'affected:lint --only-failed',
      description:
        'Rerun the lint target only for the projects that failed last time',
    },
    {
      command: 'affected:lint --all',
      description: 'Run the lint target for all projects',
    },
    {
      command: 'affected:lint --files=libs/mylib/src/index.ts',
      description:
        'Run lint for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:lint --base=main --head=HEAD',
      description:
        'Run lint for all the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:lint --base=main~1 --head=main',
      description:
        'Run lint for all the projects affected by the last commit on main',
    },
  ],
  'affected:apps': [
    {
      command: 'affected:apps --files=libs/mylib/src/index.ts',
      description:
        'Print the names of all the apps affected by changing the index.ts file',
    },
    {
      command: 'affected:apps --base=main --head=HEAD',
      description:
        'Print the names of all the apps affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:apps --base=main~1 --head=main',
      description:
        'Print the names of all the apps affected by the last commit on main',
    },
  ],
  'affected:libs': [
    {
      command: 'affected:libs --files=libs/mylib/src/index.ts',
      description:
        'Print the names of all the libs affected by changing the index.ts file',
    },
    {
      command: 'affected:libs --base=main --head=HEAD',
      description:
        'Print the names of all the libs affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:libs --base=main~1 --head=main',
      description:
        'Print the names of all the libs affected by the last commit on main',
    },
  ],
  'format:write': [],
  'format:check': [],
  'dep-graph': [
    {
      command: 'dep-graph',
      description: 'Open the dep graph of the workspace in the browser',
    },
    {
      command: 'dep-graph --file=output.json',
      description: 'Save the dep graph into a json file',
    },
    {
      command: 'dep-graph --file=output.html',
      description:
        'Generate a static website with dep graph into an html file, accompanied by an asset folder called static',
    },
    {
      command: 'dep-graph --focus=todos-feature-main',
      description:
        'Show the graph where every node is either an ancestor or a descendant of todos-feature-main',
    },
    {
      command: 'dep-graph --include=project-one,project-two',
      description: 'Include project-one and project-two in the dep graph',
    },
    {
      command: 'dep-graph --exclude=project-one,project-two',
      description: 'Exclude project-one and project-two from the dep graph',
    },
    {
      command:
        'dep-graph --focus=todos-feature-main --exclude=project-one,project-two',
      description:
        'Show the graph where every node is either an ancestor or a descendant of todos-feature-main, but exclude project-one and project-two',
    },
    {
      command: 'dep-graph --watch',
      description: 'Watch for changes to dep graph and update in-browser',
    },
  ],
  'affected:dep-graph': [
    {
      command: 'affected:dep-graph --files=libs/mylib/src/index.ts',
      description:
        'Open the dep graph of the workspace in the browser, and highlight the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:dep-graph --base=main --head=HEAD',
      description:
        'Open the dep graph of the workspace in the browser, and highlight the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:dep-graph --base=main --head=HEAD --file=output.json',
      description:
        'Save the dep graph of the workspace in a json file, and highlight the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:dep-graph --base=main --head=HEAD --file=output.html',
      description:
        'Generate a static website with dep graph data in an html file, highlighting the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:dep-graph --base=main~1 --head=main',
      description:
        'Open the dep graph of the workspace in the browser, and highlight the projects affected by the last commit on main',
    },
    {
      command: 'affected:dep-graph --exclude=project-one,project-two',
      description:
        'Open the dep graph of the workspace in the browser, highlight the projects affected, but exclude project-one and project-two',
    },
  ],
  'workspace-generator': [],
  list: [
    {
      command: 'list',
      description: 'List the plugins installed in the current workspace',
    },
    {
      command: 'list @nrwl/web',
      description:
        'List the generators and executors available in the `@nrwl/web` plugin if it is installed (If the plugin is not installed `nx` will show advice on how to add it to your workspace)',
    },
  ],
  'run-many': [
    {
      command: 'run-many --target=test --all',
      description: 'Test all projects',
    },
    {
      command: 'run-many --target=test --projects=proj1,proj2',
      description: 'Test proj1 and proj2',
    },
    {
      command: 'run-many --target=test --projects=proj1,proj2 --parallel=2',
      description: 'Test proj1 and proj2 in parallel',
    },
  ],
  migrate: [
    {
      command: 'migrate next',
      description:
        'Update @nrwl/workspace to "next". This will update other packages and will generate migrations.json',
    },
    {
      command: 'migrate 9.0.0',
      description:
        'Update @nrwl/workspace to "9.0.0". This will update other packages and will generate migrations.json',
    },
    {
      command:
        'migrate @nrwl/workspace@9.0.0 --from="@nrwl/workspace@8.0.0,@nrwl/node@8.0.0"',
      description:
        'Update @nrwl/workspace and generate the list of migrations starting with version 8.0.0 of @nrwl/workspace and @nrwl/node, regardless of what installed locally',
    },
    {
      command:
        'migrate @nrwl/workspace@9.0.0 --to="@nrwl/react@9.0.1,@nrwl/angular@9.0.1"',
      description:
        'Update @nrwl/workspace to "9.0.0". If it tries to update @nrwl/react or @nrwl/angular, use version "9.0.1"',
    },
    {
      command: 'migrate another-package@12.0.0',
      description:
        'Update another-package to "12.0.0". This will update other packages and will generate migrations.json file',
    },
    {
      command: 'migrate --run-migrations=migrations.json',
      description:
        'Run migrations from the migrations.json file. You can modify migrations.json and run this command many times',
    },
  ],
};
