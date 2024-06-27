export interface Example {
  command: string;
  description: string;
}

export const examples: Record<string, Example[]> = {
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
      command: "affected -t=build --exclude='*,!tag:dotnet'",
      description: 'Run build for only projects with the tag `dotnet`',
    },
    {
      command: 'affected -t build --tag=$NX_TASK_TARGET_PROJECT:latest',
      description: 'Use the currently executing project name in your command',
    },

    {
      command: 'affected -t=build --graph',
      description: 'Preview the task graph that Nx would run inside a webview',
    },

    {
      command: 'affected -t=build --graph=output.json',
      description: 'Save the task graph to a file',
    },

    {
      command: 'affected -t=build --graph=stdout',
      description: 'Print the task graph to the console',
    },
  ],
  'affected:test': [
    {
      command: 'affected:test --parallel=5',
      description: 'Run tests in parallel',
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
      command: 'graph --print',
      description: 'Print the project graph as JSON to the console',
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
      command: 'run-many --targets=lint,test,build',
      description:
        'Run lint, test, and build targets for all projects. Requires Nx v15.4+',
    },

    {
      command: 'run-many -t=build --graph',
      description: 'Preview the task graph that Nx would run inside a webview',
    },

    {
      command: 'run-many -t=build --graph=output.json',
      description: 'Save the task graph to a file',
    },

    {
      command: 'run-many -t=build --graph=stdout',
      description: 'Print the task graph to the console',
    },
  ],
  run: [
    {
      command: 'run myapp:build',
      description: 'Run the target build for the myapp project',
    },

    {
      command: 'run myapp:build:production',
      description:
        'Run the target build for the myapp project, with production configuration',
    },

    {
      command: 'run myapp:build --graph',
      description: 'Preview the task graph that Nx would run inside a webview',
    },

    {
      command: 'run myapp:build --graph=output.json',
      description: 'Save the task graph to a file',
    },

    {
      command: 'run myapp:build --graph=stdout',
      description: 'Print the task graph to the console',
    },

    {
      command: 'run myapp:"build:test"',
      description:
        'Run\'s a target named build:test for the myapp project. Note the quotes around the target name to prevent "test" from being considered a configuration',
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
  reset: [
    {
      command: 'reset',
      description:
        'Clears the internal state of the daemon and metadata that Nx is tracking. Helpful if you are getting strange errors and want to start fresh',
    },
    {
      command: 'reset --only-cache',
      description:
        'Clears the Nx Cache directory. This will remove all local cache entries for tasks, but will not affect the remote cache',
    },
    {
      command: 'reset --only-daemon',
      description:
        'Stops the Nx Daemon, it will be restarted fresh when the next Nx command is run.',
    },
    {
      command: 'reset --only-workspace-data',
      description:
        'Clears the workspace data directory. Used by Nx to store cached data about the current workspace (e.g. partial results, incremental data, etc)',
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
        'Show all projects with names starting with "api-". The "projects" option is useful to see which projects would be selected by run-many',
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
      command: 'show projects --affected --type app',
      description: 'Show affected apps in the workspace',
    },

    {
      command: 'show projects --affected --exclude=*-e2e',
      description:
        'Show affected projects in the workspace, excluding end-to-end projects',
    },

    {
      command: 'show project my-app',
      description:
        'If in an interactive terminal, opens the project detail view. If not in an interactive terminal, defaults to JSON',
    },

    {
      command: 'show project my-app --json',
      description: 'Show detailed information about "my-app" in a json format',
    },

    {
      command: 'show project my-app --json false',
      description: 'Show information about "my-app" in a human readable format',
    },

    {
      command: 'show project my-app --web',
      description:
        'Opens a web browser to explore the configuration of "my-app"',
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
  add: [
    {
      command: 'add @nx/react',
      description:
        'Install the `@nx/react` package matching the installed version of the `nx` package and run its `@nx/react:init` generator',
    },
    {
      command: 'add non-core-nx-plugin',
      description:
        'Install the latest version of the `non-core-nx-plugin` package and run its `non-core-nx-plugin:init` generator if available',
    },
    {
      command: 'add @nx/react@17.0.0',
      description:
        'Install version `17.0.0` of the `@nx/react` package and run its `@nx/react:init` generator',
    },
  ],
};
