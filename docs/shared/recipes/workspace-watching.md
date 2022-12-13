# Workspace Watching

Nx can watch your workspace and execute commands based on project or files changes.

Imagine the following project graph with these packages:

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "type": "lib",
      "name": "main-lib"
    },
    {
      "type": "lib",
      "name": "lib"
    },
    {
      "type": "lib",
      "name": "lib2"
    },
    {
      "type": "lib",
      "name": "lib3"
    }
  ],
  "groupByFolder": false,
  "dependencies": {
    "main-lib": [
      {
        "target": "lib",
        "source": "main-lib",
        "type": "direct"
      },
      {
        "target": "lib2",
        "source": "main-lib",
        "type": "direct"
      },
      {
        "target": "lib3",
        "source": "main-lib",
        "type": "direct"
      }
    ],
    "lib": [],
    "lib2": [],
    "lib3": []
  },
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

Traditionally, if you want to rebuild your packages whenever they change, you would have to set up an ad-hoc watching system to watch each package. Rather than setting up a watch manually, we can use Nx and allow it to execute a command whenever a package changes.

With the following command, we can tell Nx to watch all projects, and execute `nx run $NX_PROJECT_NAME:build` for each change.

{% callout type="note" title="Environment Variables" %}
Nx will run the callback command with the `$NX_PROJECT_NAME` and `$NX_FILE_CHANGES` environment variables set.

To use these in the callback portion of the watch command, the `$` needs to be escaped with a backslash (`\`)
{% /callout %}

```shell
nx watch --all -- nx run \$NX_PROJECT_NAME:build
```

Now every time a package changes, Nx will run the build.

If multiple packages change at the same time, Nx will run the callback for each changed project. Then if additional changes happen while a command is in progress, Nx will batch those changes, and execute them once the current command completes.

### Watching for specific projects

To watch for specific projects and echo the changed files, run this command:

```shell
nx watch --projects=app1,app2 -- echo \$NX_CHANGED_FILES
```

### Watching for dependent projects

To watch for a project and it's dependencies, run this command:

```shell
nx watch --projects=app1 --includeDependentProjects -- echo \$NX_PROJECT_NAME
```

### Running Nx watch with package managers

In the examples above, the `nx watch` command was run directly in the terminal. Usually environments aren't set up to include node_module bins automatically in the shell path, and people use their respective package manager's exec command. For example, `npx`, `yarn`, `pnpm run`.

If we try to run `npx nx watch --all -- echo \$NX_PROJECT_NAME`, (or equivalent), the watch command may not execute as you expect.

Below are the ways to run the watch with each package manager.

#### pnpm

```shell
pnpm nx watch --all -- echo \$NX_PROJECT_NAME
```

#### yarn

```shell
yarn nx -- watch --all -- echo \$NX_PROJECT_NAME
```

#### npx

```shell
npx -c 'nx watch --all -- echo \$NX_PROJECT_NAME'
```
