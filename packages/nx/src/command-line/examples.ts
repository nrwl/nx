export interface Example {
  command: string;
  description: string;
}

export const examples: Record<string, Example[]> = {
  'print-affected': [
    {
      command: 'print-affected',
      description:
        'Print information about affected projects and the project graph',
    },
    {
      command: 'print-affected --base=main --head=HEAD',
      description:
        'Print information about the projects affected by the changes between main and HEAD (e.g,. PR)',
    },
    {
      command: 'print-affected -t test',
      description:
        'Prints information about the affected projects and a list of tasks to test them',
    },
    {
      command: 'print-affected -t build --select=projects',
      description:
        'Prints the projects property from the print-affected output',
    },
    {
      command: 'print-affected -t build --select=tasks.target.project',
      description:
        'Prints the tasks.target.project property from the print-affected output',
    },
  ],
  affected: [
    {
      command: 'affected -t custom-target',
      description: 'Run custom target for all affected projects',
    },
    {
      command: 'affected -t test --parallel=5',
      description: 'Run tests in parallel',
    },
    {
      command: 'affected -t test --all',
      description: 'Run the test target for all projects',
    },
    {
      command: 'affected -t lint test build',
      description:
        'Run lint, test, and build targets for affected projects. Requires Nx v15.4+',
    },
    {
      command: 'affected -t test --files=libs/mylib/src/index.ts',
      description:
        'Run tests for all the projects affected by changing the index.ts file',
    },
    {
      command: 'affected -t test --base=main --head=HEAD',
      description:
        'Run tests for all the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected -t test --base=main~1 --head=main',
      description:
        'Run tests for all the projects affected by the last commit on main',
    },
    {
      command: "affected -t build --exclude '*,!tag:dotnet'",
      description: 'Run build for only projects with the tag `dotnet`',
    },
    {
      command: 'affected -t build --tag=$NX_TASK_TARGET_PROJECT:latest',
      description: 'Use the currently executing project name in your command.',
    },
  ],
  'affected:test': [
    {
      command: 'affected:test --parallel=5',
      description: 'Run tests in parallel',
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
  'format:write': [],
  'format:check': [],
  graph: [
    {
      command: 'graph',
      description: 'Open the project graph of the workspace in the browser',
    },
    {
      command: 'graph --file=output.json',
      description: 'Save the project graph into a json file',
    },
    {
      command: 'graph --file=output.html',
      description:
        'Generate a static website with project graph into an html file, accompanied by an asset folder called static',
    },
    {
      command: 'graph --focus=todos-feature-main',
      description:
        'Show the graph where every node is either an ancestor or a descendant of todos-feature-main',
    },
    {
      command: 'graph --include=project-one,project-two',
      description: 'Include project-one and project-two in the project graph',
    },
    {
      command: 'graph --exclude=project-one,project-two',
      description: 'Exclude project-one and project-two from the project graph',
    },
    {
      command:
        'graph --focus=todos-feature-main --exclude=project-one,project-two',
      description:
        'Show the graph where every node is either an ancestor or a descendant of todos-feature-main, but exclude project-one and project-two',
    },
    {
      command: 'graph --watch',
      description: 'Watch for changes to project graph and update in-browser',
    },
  ],
  'affected:graph': [
    {
      command: 'affected:graph --files=libs/mylib/src/index.ts',
      description:
        'Open the project graph of the workspace in the browser, and highlight the projects affected by changing the index.ts file',
    },
    {
      command: 'affected:graph --base=main --head=HEAD',
      description:
        'Open the project graph of the workspace in the browser, and highlight the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:graph --base=main --head=HEAD --file=output.json',
      description:
        'Save the project graph of the workspace in a json file, and highlight the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:graph --base=main --head=HEAD --file=output.html',
      description:
        'Generate a static website with project graph data in an html file, highlighting the projects affected by the changes between main and HEAD (e.g., PR)',
    },
    {
      command: 'affected:graph --base=main~1 --head=main',
      description:
        'Open the project graph of the workspace in the browser, and highlight the projects affected by the last commit on main',
    },
    {
      command: 'affected:graph --exclude=project-one,project-two',
      description:
        'Open the project graph of the workspace in the browser, highlight the projects affected, but exclude project-one and project-two',
    },
  ],
  'workspace-generator': [],
  list: [
    {
      command: 'list',
      description: 'List the plugins installed in the current workspace',
    },
    {
      command: 'list @nx/web',
      description:
        'List the generators and executors available in the `@nx/web` plugin if it is installed (If the plugin is not installed `nx` will show advice on how to add it to your workspace)',
    },
  ],
  'run-many': [
    {
      command: 'run-many -t test',
      description: 'Test all projects',
    },
    {
      command: 'run-many -t test -p proj1 proj2',
      description: 'Test proj1 and proj2 in parallel',
    },
    {
      command: 'run-many -t test -p proj1 proj2 --parallel=5',
      description: 'Test proj1 and proj2 in parallel using 5 workers',
    },
    {
      command: 'run-many -t test -p proj1 proj2 --parallel=false',
      description: 'Test proj1 and proj2 in sequence',
    },
    {
      command: 'run-many -t test --projects=*-app --exclude excluded-app',
      description:
        'Test all projects ending with `*-app` except `excluded-app`.  Note: your shell may require you to escape the `*` like this: `\\*`',
    },
    {
      command: 'run-many -t test --projects=tag:api-*',
      description:
        'Test all projects with tags starting with `api-`.  Note: your shell may require you to escape the `*` like this: `\\*`',
    },
    {
      command: 'run-many -t test --projects=tag:type:ui',
      description: 'Test all projects with a `type:ui` tag',
    },
    {
      command: 'run-many -t test --projects=tag:type:feature,tag:type:ui',
      description: 'Test all projects with a `type:feature` or `type:ui` tag',
    },
    {
      command: 'run-many --targets=lint,test,build --all',
      description:
        'Run lint, test, and build targets for all projects. Requires Nx v15.4+',
    },
  ],
  migrate: [
    {
      command: 'migrate latest',
      description:
        'Update all Nx plugins to "latest". This will generate migrations.json',
    },
    {
      command: 'migrate 9.0.0',
      description:
        'Update all Nx plugins to "9.0.0". This will generate migrations.json',
    },
    {
      command:
        'migrate @nx/workspace@9.0.0 --from="@nx/workspace@8.0.0,@nx/node@8.0.0"',
      description:
        'Update @nx/workspace and generate the list of migrations starting with version 8.0.0 of @nx/workspace and @nx/node, regardless of what is installed locally',
    },
    {
      command:
        'migrate @nx/workspace@9.0.0 --to="@nx/react@9.0.1,@nx/angular@9.0.1"',
      description:
        'Update @nx/workspace to "9.0.0". If it tries to update @nx/react or @nx/angular, use version "9.0.1"',
    },
    {
      command: 'migrate another-package@12.0.0',
      description:
        'Update another-package to "12.0.0". This will update other packages and will generate migrations.json file',
    },
    {
      command: 'migrate latest --interactive',
      description:
        'Collect package updates and migrations in interactive mode. In this mode, the user will be prompted whether to apply any optional package update and migration',
    },
    {
      command: 'migrate latest --from=nx@14.5.0 --exclude-applied-migrations',
      description:
        'Collect package updates and migrations starting with version 14.5.0 of "nx" (and Nx first-party plugins), regardless of what is installed locally, while excluding migrations that should have been applied on previous updates',
    },
    {
      command: 'migrate --run-migrations=migrations.json',
      description:
        'Run migrations from the provided migrations.json file. You can modify migrations.json and run this command many times',
    },
    {
      command: 'migrate --run-migrations --create-commits',
      description:
        'Create a dedicated commit for each successfully completed migration. You can customize the prefix used for each commit by additionally setting --commit-prefix="PREFIX_HERE "',
    },
  ],
  show: [
    {
      command: 'show projects',
      description: 'Show all projects in the workspace',
    },

    {
      command: 'show projects --projects api-*',
      description:
        'Show all projects with names starting with "api-". The "projects" option is useful to see which projects would be selected by run-many.',
    },

    {
      command: 'show projects --with-target serve',
      description: 'Show all projects with a serve target',
    },

    {
      command: 'show projects --affected',
      description: 'Show affected projects in the workspace',
    },

    {
      command: 'show projects --affected --exclude *-e2e',
      description:
        'Show affected projects in the workspace, excluding end-to-end projects',
    },

    {
      command: 'show project my-app',
      description: 'Show detailed information about "my-app" in a json format.',
    },

    {
      command: 'show project my-app --json false',
      description:
        'Show information about "my-app" in a human readable format.',
    },
  ],
  watch: [
    {
      command:
        'watch --projects=app -- echo \\$NX_PROJECT_NAME \\$NX_FILE_CHANGES',
      description:
        'Watch the "app" project and echo the project name and the files that changed',
    },
    {
      command:
        'watch --projects=app1,app2 --includeDependentProjects -- echo \\$NX_PROJECT_NAME',
      description:
        'Watch "app1" and "app2" and echo the project name whenever a specified project or its dependencies change',
    },
    {
      command: 'watch --all -- echo \\$NX_PROJECT_NAME',
      description:
        'Watch all projects (including newly created projects) in the workspace',
    },
  ],
};
