# Inputs and Named Inputs

When Nx [computes the hash for a given operation](/concepts/how-caching-works), it takes into account the `inputs` of the target.
The `inputs` are a list of **file sets**, **runtime** inputs and **environment variables** that affect the output of the target.
If any of the `inputs` change, the cache is invalidated and the target is re-run.

## Types of Inputs

Nx can consider the following types of Inputs when computing the hash for a given operation.

### Project Configuration

Nx always considers the configuration of the project of a task and its dependencies when calculating the hash of a task.

### Command Arguments

Passing different arguments to an Nx command will often change the behavior of a task. Nx will filter out arguments which are for Nx itself and do not have any effect on running of tasks such as `--parallel` or `--projects`.

For example, running `nx build myreactapp --prod` will not reuse the cached output of running `nx build myreactapp`.

### Source Files

Changing source code will often change the behavior of a task. Nx can consider the contents of files matching a pattern when calculating the computation hash.
Source file inputs are defined like this:

```jsonc
"inputs": {
  "{projectRoot}/**/*", // All files in a project
  "{workspaceRoot}/.gitignore", // A specific file in the workspace
  "{projectRoot}/**/*.ts", // A glob pattern for files
  "!{projectRoot}/**/*.spec.ts", // Excluding files matching a glob pattern
}
```

Source file inputs must be prefixed with either `{projectRoot}` or `{workspaceRoot}` to distinguish where the paths should be resolved from. `{workspaceRoot}` should only appear in the beginning of an input but `{projectRoot}` and `{projectName}` can be specified later in the input to interpolate the root or name of the project into the input location.

Prefixing a source file input with `!` will exclude the files matching the pattern from the set of files used to calculate the hash.
Prefixing a source file input with `^` means this entry applies to the project dependencies of the project, not the project itself.

By default, Nx will use all files in a project as well as all files in the project's dependencies when computing a hash for tasks belonging to the project.
This may cause Nx to rerun some tasks even when files irrelevant to the task have changed but it ensures that by default, Nx always re-runs the task when it should.

To get a better idea of how to use inputs, you can browse some [common input sets](/recipes/running-tasks/configure-inputs#common-inputs).

### Environment Variables

Tools and scripts will often use some environment variables to change their behavior. Nx can consider the value of environment variables when calculating the computation hash in order to invalidate the cache if the environment variable value changes. Environment variable inputs are defined like this:

```jsonc
"inputs": [
  { "env": "API_KEY" } // this will include the value of $API_KEY in the cache hash
]
```

### Runtime Inputs

You can use a Runtime input to provide a script which will output the information you want to include in the computation hash. Runtime inputs are defined like this:

```jsonc
"inputs": [
  { "runtime": "node --version" }
]
```

This kind of input is often used to include versions of tools used to run the task. You should ensure that these scripts work on any platform where the workspace is used. Avoid using `.sh` or `.bat` files as these will not work across Windows and \*nix operating systems.

### External Dependencies

Source code often imports from external dependencies installed through package managers. For example, a React application will likely import `react`. It is not needed to configure those `externalDependencies` directly. Nx will always consider external dependencies depended upon by any source code within the project.

External dependencies can also be tools used to run tasks. Updating the versions of those tools will change the behavior of those tasks. External dependencies inputs are defined like this:

```jsonc
"inputs": [
  { "externalDependencies": ["jest"] }
]
```

By default, if no external dependencies inputs are specified, Nx will include the hash of all external dependencies of the workspace in the computation hash.
For many targets, Nx does not know which external dependencies are used and which are not.
By considering all external dependencies, Nx will always re-run tasks when necessary even though in some cases, it might have been able to restore from cache.

For example, when defining a target to run `eslint .`, Nx does not know which ESLint plugins are used by the eslint config.
To be safe, it will consider all external dependencies, including all ESLint plugins, to ensure that the `lint` task is re-run when any of the plugins have been updated.
The drawback of this assumption is that Nx will re-run the `lint` task even when external dependencies not used by ESLint are updated.

```jsonc
"targets": {
  "lint": {
    "command": "eslint ."
  }
}
```

This default behavior can be overridden by adding any external dependency inputs and enables Nx to use cached results more often.

```jsonc {% highlightLines=[6] %}
"targets": {
  "lint": {
    "command": "eslint .",
    "inputs": [
      "default",
      { "externalDependencies": ["eslint", "eslint-config-airbnb"] }
    ]
  }
}
```

Targets which use an executor from a Nx Plugin maintained by the Nx Team will have the correct set of external dependencies considered when calculating the hash.

### Outputs of Dependent Tasks

When a task depends on another task, it is possible that the outputs of the dependent task will affect the behavior of the task. The Nx caching mechanism can consider the contents of files produced by dependent tasks that match a pattern. Use outputs of dependent tasks as inputs like this:

```jsonc
"inputs": [
  { "dependentTasksOutputFiles": "**/*.d.ts" },
  { "dependentTasksOutputFiles": "**/*.d.ts", "transitive": true }
]
```

The pattern will be matched with outputs of tasks which this task depends on. Setting `transitive` to `true` will also include outputs of all task dependencies of this task in the [task pipeline](/concepts/task-pipeline-configuration).

### A subset of the root `tsconfig.json` or `tsconfig.base.json`

When a root `tsconfig.json` or `tsconfig.base.json` is present, Nx will always consider parts of the file which apply to the project of a task being run.
This includes the full `compilerOptions` section and particular path mappings in the `compilerOptions.paths` property.
This allows Nx to to not invalidate every single task when a path mapping is added or removed from the root `tsconfig.json` file

## Named Inputs

Many tasks will utilize the same sets of inputs with minor differences. Nx allows you to define these sets in the `namedInputs` section of the `nx.json` file.

These sets of inputs can then be referenced and reused in the `inputs` array of targets. You can think of these as variables which can be used in the `inputs` array.

Named Inputs can be defined for the entire workspace in `nx.json` or for a specific project in `project.json`/`package.json`.

### Workspace Level Named Inputs

Named inputs defined in `nx.json` can be used by any project in the workspace in the `inputs` array. The following example shows how to define named inputs for the entire workspace in `nx.json`.

```jsonc {% fileName="nx.json" highlightLines=["2-4"] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"] // Default Inputs
  }
}
```

### Project Level Named Inputs

Named inputs defined in `package.json` or `project.json` define the value of the named input for tasks belonging to that specific project.

Naming a set of inputs with the same name as a set of inputs defined for the workspace in `nx.json` will override the meaning of that set for the project.

{% tabs %}
{% tab label="project.json" %}

```jsonc {% fileName="project.json" highlightLines=["2-6"] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"], // Default Inputs
    "production": ["default", "!{projectRoot}/jest.config.ts"], // Production Inputs
    "sharedGlobals": [] // Shared Global Inputs
  },
  "targets": { ... }
}
```

{% /tab %}
{% tab label="Project Level (package.json)" %}

```jsonc {% fileName="package.json" highlightLines=["3-7"] %}
{
  "dependencies": { ... }
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"], // Default Inputs
    "production": ["default", "!{projectRoot}/jest.config.ts"], // Production Inputs
    "sharedGlobals": [] // Shared Global Inputs
  },
}
```

{% /tab %}
{% /tabs %}

### Named Input Conventions

By default, Nx Workspaces are generated with the following named inputs:

```jsonc {% fileName="nx.json" %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"], // Default Inputs
    "production": ["default", "!{projectRoot}/jest.config.ts"], // Production Inputs
    "sharedGlobals": [] // Shared Global Inputs
  }
}
```

The above inputs follow a convention that Nx recommends for named inputs. Nx generates these by default but you can also introduce your own conventions.

#### Default Inputs

The `default` inputs include all files in a project as well as any shared global inputs which should be considered for all tasks. Defaulting to the set of everything that matters ensures that Nx will always re-run tasks when necessary by default.

#### Shared Global Inputs

The `sharedGlobal` inputs include things that Nx should always look at when determining computation hashes. For instance, this could be the OS where the command is being run or the version of Node.

#### Production Inputs

The `production` inputs only include the set of files in a project which will affect behavior of the project in production.
For instance, the `main.ts` of an application will be compiled as the main application logic and will affect the end user experience while files such as `.eslintrc.json` only affect the tools used by the developers and have no direct impact on the end user experience.
In general, it is best to define the `production` inputs as the `default` inputs (everything) excluding the specific files which are known not to affect end user experience. This makes it so that by default, all files are considered to affect end user behavior unless excluded from the `production` fileset.

### Using Named Inputs on Project Dependencies

It is common for most tasks to consider a set of inputs for the project it belongs to and a set of inputs for dependencies of the project. For instance, running the tests of a project should consider all files of the project being tested but only production files of its dependencies. The following `inputs` configuration uses named inputs in two different ways:

```jsonc {% fileName="project.json" highlightLines=["5"] %}
{
  "name": "myreactapp",
  "targets": {
    "test": {
      "inputs": ["default", "^production", "{projectRoot}/jest.config.js"]
    }
  }
}
```

1. `default` tells Nx to consider all files within the project root of `myreactapp` when running the `test` task.
2. `^production` is prefixed with `^` and applies the to projects which `myreactapp` depends on.
3. You can add other modifications to the inputs set directly without defining them as named inputs.

All of the above inputs are taken into consideration when the following command is run:

```shell
nx test myreactapp
```

{% cards %}
{% card title="nx.json reference" type="documentation" description="namedInputs can be defined in nx.json" url="/reference/nx-json#inputs-namedinputs" /%}
{% card title="Project configuration reference" type="documentation" description="inputs and namedInputs can be defined in project configuration" url="/reference/project-configuration#inputs-and-named-inputs" /%}
{% card title="Configure Inputs for Task Caching" type="documentation" description="This recipes walks you through a few examples of how to configure inputs and namedInputs" url="/recipes/running-tasks/configure-inputs" /%}
{% /cards %}
