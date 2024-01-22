# Workspace Watching

Nx can watch your workspace and execute commands based on project or files changes.

{% callout type="note" title="Nx Versioning" %}
Workspace watching is available with Nx version 15.4.0 and higher.
{% /callout %}

Imagine the following project graph with these projects:

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "type": "lib",
      "name": "main-lib",
      "data": {
        "tags": []
      }
    },
    {
      "type": "lib",
      "name": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "type": "lib",
      "name": "lib2",
      "data": {
        "tags": []
      }
    },
    {
      "type": "lib",
      "name": "lib3",
      "data": {
        "tags": []
      }
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

Traditionally, if you want to rebuild your projects whenever they change, you would have to set up an ad-hoc watching system to watch each project. Rather than setting up a watch manually, Nx can be used to watch projects and execute a command whenever they change.

With the following command, Nx is told to watch all projects, and execute `nx run $NX_PROJECT_NAME:build` for each change.

```shell
nx watch --all -- nx run \$NX_PROJECT_NAME:build
```

{% callout type="note" title="Escaping" %}

Note the backslash (`\`) before the `$`. This is needed so that your shell doesn't automatically interpolate the variables.

There are also some quirks if this command is ran with a package manager. [Find out how to run this command with those managers here.](#running-nx-watch-with-package-managers)

{% /callout %}

Now every time a package changes, Nx will run the build.

If multiple packages change at the same time, Nx will run the callback for each changed project. Then if additional changes happen while a command is in progress, Nx will batch those changes, and execute them once the current command completes.

## Watch Environment Variables

Nx will run the watch callback command with the `NX_PROJECT_NAME` and `NX_FILE_CHANGES` environment variables set.

- `NX_PROJECT_NAME` will be the name of the project.
- `NX_FILE_CHANGES` will be a list of files that changed formatted in stdin (ie, if `file1.txt`, and `file2.txt` change, `NX_FILE_CHANGES` will be `file1.txt file2.txt`. This allows you to pass the list of files to other commands that accept this format.)

### Running Nx watch with package managers

In the examples above, the `nx watch` command was run directly in the terminal. Usually environments aren't set up to include node_module bins automatically in the shell path, so using the package manager's run/exec command is used. For example, `npx`, `yarn`, `pnpm run`.

When running `npx nx watch --all -- echo \$NX_PROJECT_NAME`, (or equivalent), the watch command may not execute as expected. For example, the environment variables seem to be blank.

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

{% callout type="note" title="Windows" %}

If you're running these commands on Windows Powershell (not WSL), the environment variables need to be wrapped in `%`.

For example:

```shell
yarn nx -- watch --all -- echo %NX_PROJECT_NAME%
```

{% /callout %}

## Additional Use Cases

### Watching for specific projects

To watch for specific projects and echo the changed files, run this command:

```shell
nx watch --projects=app1,app2 -- echo \$NX_FILE_CHANGES
```

### Watching for dependent projects

To watch for a project and it's dependencies, run this command:

```shell
nx watch --projects=app1 --includeDependentProjects -- echo \$NX_PROJECT_NAME
```
