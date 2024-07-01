# Launch Templates

A launch template defines the setup steps Nx Agents will run before running tasks. A custom launch template isn't required to use Nx Agents.
Nx Cloud provides several pre-built launch templates for common use-cases. You can view available templates in the [`nx-cloud-workflows` repository](https://github.com/nrwl/nx-cloud-workflows/tree/main/launch-templates).

{% github-repository url="https://github.com/nrwl/nx-cloud-workflows/tree/main/launch-templates" title="Pre-Built Launch Templates" /%}

## Getting Started with Custom Launch Templates

The easiest way to create a new custom launch template is to modify one of the pre-built ones. To do that, create a file in the
`.nx/workflows` folder and copy one of the [pre-built templates](https://github.com/nrwl/nx-cloud-workflows/blob/main/launch-templates/linux.yaml). You can name the file any way you want (e.g., `agents.yaml`) and customize the steps as needed.

## Launch Template Structure

### `launch-templates`

A `map` of launch template configurations. This value is required.

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
```

### `launch-templates.<template-name>`

The name of your custom launch template. This name is used via `--distribute-on="<# of agents> <template-name>"` when starting the ci run. Supports one to many uniquely named launch templates.
Multiple launch templates can be useful for setting up different toolchains (rust, java, node versions) or resources classes for your workspace needs.

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  template-one:
  template-two:
```

```
nx-cloud start-ci-run --distribute-on="3 template-one"
```

### `launch-templates.<template-name>.resource-class`

A launch template's `resource-class` defines the memory and vCPUs available to each agent machine.

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  template-one:
    resource-class: 'docker_linux_amd64/medium'
```

The following resource classes are available:

- `docker_linux_amd64/small`
- `docker_linux_amd64/medium`
- `docker_linux_amd64/medium+`
- `docker_linux_amd64/large`
- `docker_linux_amd64/large+`
- `docker_linux_amd64/extra_large`
- `docker_linux_amd64/extra_large+`
- `docker_linux_arm64/medium`
- `docker_linux_arm64/large`
- `docker_linux_arm64/extra_large`
- `windows/medium`

See their detailed description and pricing at [nx.app/pricing](https://nx.app/pricing#plan-detail?sutm_source=nx.dev&utm_medium=launch-templates).

### `launch-templates.<template-name>.image`

A launch template's `image` defines the available base software for the agent machine.

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  template-one:
    image: 'ubuntu22.04-node20.11-v9'
```

Nx Cloud provides the following images:

> Changes added in previous images are included in newer images unless otherwise denoted
> Images also have [go 1.22](https://go.dev/) installed

- `ubuntu22.04-node20.11-v5`
  - added elevated permission access via `sudo`
- `ubuntu22.04-node20.11-v6`

  - `corepack` is enabled by default
  - default global package manager versions:
    - `npm` v10
    - `yarn` v1
    - `pnpm` v8
    - See how to install a [specific package manger version](#specific-package-manager-version)

- `ubuntu22.04-node20.11-v7`
  - added java version 17
- `ubuntu22.04-node20.11-v9`
  - added [nvm](https://github.com/nvm-sh/nvm)
- `windows-2022`

> Note: Windows-based images can only run on Windows-based [resource classes](#launch-templatestemplate-nameresourceclass).

Enterprise accounts can use custom images.

### `launch-templates.<template-name>.env`

A launch template's `env` defines a `map` of environment variable names and values to be available within **all** steps of the specific launch template.

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  template-one:
    env:
      MY_ENV_VAR: 'my-var-value'
```

### `launch-templates.<template-name>.init-steps`

A launch template's `init-steps` defines the series of steps to perform before an Nx Agent runs. Without a defined `init-steps` the Nx Agent is unable to process any tasks.

Typical `init-steps` perform actions such as checking out your workspace source code and installing any necessary dependencies. Any extra setup your workspace needs to run should be defined as an `init-step`. Once all steps run successfully, the agent machine will inform Nx Cloud that it is ready to accept tasks.

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  template-one:
    init-steps:
```

### `launch-templates.<template-name>.init-steps[*].name`

An init-step's `name` is the label that will be reflected in the Nx Cloud UI. `name` can be used in conjunction with [`uses`](#launch-templatestemplate-nameinit-stepsuses) and [`script`](#launch-templatestemplate-nameinit-stepsscript)

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  template-one:
    init-steps:
      - name: 'My Helpful Step Name'
```

### `launch-templates.<template-name>.init-steps[*].uses`

When defined, specifies an existing step file to be used. **Cannot be used when `script` is also defined**

You can find the [list of Nx Cloud reusable steps here](https://github.com/nrwl/nx-cloud-workflows/tree/main/workflow-steps). If you cannot find a reusable step that suits your needs, [you can create your own custom steps](/ci/reference/custom-steps).

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  template-one:
    init-steps:
      - uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/checkout/main.yaml'
      - name: 'Install Node Modules'
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/install-node-modules/main.yaml'
```

### `launch-templates.<template-name>.init-steps[*].script`

When defined, allows an inline script to be run. **Cannot be used when `uses` is also defined**

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  template-one:
    init-steps:
      - name: 'Print Node Version and PATH'
        script: |
          node -v
          echo $PATH
```

### `launch-templates.<template-name>.init-steps[*].env`

An init-step's `env` is similar to the [`launch-template.<template-name>.env`](#launch-templatestemplate-nameenv), except the environment variable `map` is **scoped for the current step only**.

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  template-one:
    init-steps:
      - name: 'Print Env'
        env:
          MY_STEP_ENV: 'step-env-var'
        script: |
          echo $MY_STEP_ENV # prints "step-env-var"
```

### `launch-templates.<template-name>.init-steps[*].inputs`

An init-step's `inputs` is defined by the step file in the [`launch-template.<template-name>.init-steps[*].uses`](#launch-templatestemplate-nameinit-stepsuses) property. Refer to the step file's documentation for specific inputs.

[Validation](#validating-launch-templates) can also be done to validate the step against the step file's defined inputs

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  template-one:
    init-steps:
      - name: Restore Node Modules Cache
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/cache/main.yaml'
        inputs:
          env: 'package-lock.json|yarn.lock|pnpm-lock.yaml'
          paths: 'node_modules'
          base-branch: 'main'
```

## Full Example

This is an example of a launch template using all pre-built features:

```yaml {% fileName="./nx/workflows/agents.yaml" %}
launch-templates:
  # Custom template name, the name is referenced via --distribute-on="3 my-linux-medium-js"
  # You can define as many templates as you need, commonly used to make different sizes or toolchains depending on your workspace needs
  my-linux-medium-js:
    # see the available resource list below
    resource-class: 'docker_linux_amd64/medium'
    # see the available image list below
    image: 'ubuntu22.04-node20.11-v9'
    # Define environment variables shared among all steps
    env:
      MY_ENV_VAR: shared
      # list out steps to run on the agent before accepting tasks
      # the agent will need a copy of the source code and dependencies installed
    init-steps:
      - name: Checkout
        # using a reusable step in an external GitHub repo,
        # this step is provided by Nx Cloud: https://github.com/nrwl/nx-cloud-workflows/tree/main/workflow-steps
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/checkout/main.yaml'
      - name: Restore Node Modules Cache
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/cache/main.yaml'
        # the cache step requires configuration via env vars
        # https://github.com/nrwl/nx-cloud-workflows/tree/main/workflow-steps/cache#options
        inputs:
          env: 'package-lock.json|yarn.lock|pnpm-lock.yaml'
          paths: 'node_modules'
          base-branch: 'main'
      - name: Restore Browser Binary Cache
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/cache/main.yaml'
        inputs:
          env: 'package-lock.json|yarn.lock|pnpm-lock.yaml|"browsers"'
          paths: |
            '~/.cache/Cypress'
            '~/.cache/ms-playwright'
          base-branch: 'main'
      - name: Install Node Modules
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/install-node-modules/main.yaml'
      - name: Install Browsers (if needed)
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/install-browsers/main.yaml'
        # You can also run a custom script to configure various things on the agent machine
      - name: Run a custom script
        script: |
          git config --global user.email test@test.com
          git config --global user.name "Test Test"
      # You can also set any other env vars to be passed to the following steps
      # by setting their value in the `$NX_CLOUD_ENV` file.
      # Most commonly for redefining PATH for further steps
      - name: Setting env
        script: |
          # Update PATH with custom value
          echo "PATH=$HOME/my-folder:$PATH" >> $NX_CLOUD_ENV
      - name: Print path from previous step
        # will include my-folder
        script: echo $PATH
      - name: Define env var for a step
        env:
          MY_ENV_VAR: 'env-var-for-step'
        # will print env-var-for-step
        script: echo $MY_ENV_VAR
      # after you're last step Nx Agents will start accepting tasks to process
      # no need to manually start up the agent yourself

  # another template which does the same as above, but with a large resource class
  # You're not required to define a template for every resource class, only define what you need!
  my-linux-large-js:
    resource-class: 'docker_linux_amd64/large'
    image: 'ubuntu22.04-node20.11-v9'
    env:
      MY_ENV_VAR: shared
    init-steps:
      - name: Checkout
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/checkout/main.yaml'
      - name: Restore Node Modules Cache
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/cache/main.yaml'
        inputs:
          env: 'package-lock.json|yarn.lock|pnpm-lock.yaml'
          paths: 'node_modules'
          base-branch: 'main'
      - name: Restore Browser Binary Cache
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/cache/main.yaml'
        inputs:
          env: 'package-lock.json|yarn.lock|pnpm-lock.yaml|"browsers"'
          paths: |
            '~/.cache/Cypress'
            '~/.cache/ms-playwright'
          base-branch: 'main'
      - name: Install Node Modules
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/install-node-modules/main.yaml'
      - name: Install Browsers (if needed)
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/install-browsers/main.yaml'
      - name: Run a custom script
        script: |
          git config --global user.email test@test.com
          git config --global user.name "Test Test"
      - name: Setting env
        script: |
          echo "PATH=$HOME/my-folder:$PATH" >> $NX_CLOUD_ENV
      - name: Print path from previous step
        script: echo $PATH
      - name: Define env var for a step
        env:
          MY_ENV_VAR: 'env-var-for-step'
        script: echo $MY_ENV_VAR
  # template that installs rust
  my-linux-rust-large:
    resource-class: 'docker_linux_amd64/large'
    image: 'ubuntu22.04-node20.11-v9'
    init-steps:
      - name: Checkout
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/checkout/main.yaml'
      - name: Restore Node Modules Cache
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/cache/main.yaml'
        inputs:
          env: 'package-lock.json|yarn.lock|pnpm-lock.yaml'
          paths: 'node_modules'
          base-branch: 'main'
      - name: Install Node Modules
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/install-node-modules/main.yaml'
      - name: Install Rust
        script: |
          curl --proto '=https' --tlsv1.3 https://sh.rustup.rs -sSf | sh -s -- -y
          source "$HOME/.cargo/env"
          rustup toolchain install 1.70.0
          # persist cargo bin into PATH
          echo "PATH=$HOME/.cargo/bin:$PATH" >> $NX_CLOUD_ENV
```

These templates can be used by passing the number of agents desired, and the template name via `--distribute-on` when starting your CI run.

```
nx-cloud start-ci-run --distribute-on="4 my-linux-medium-js"
```

```
nx-cloud start-ci-run --distribute-on="4 my-linux-large-js"
```

```
nx-cloud start-ci-run --distribute-on="4 my-linux-large-rust"
```

## Validating Launch Templates

{% callout type="note" title="Commit before Validation" %}
Before Nx Cloud can validate your custom templates, you must first commit any changes to these templates to your source control repository. Running the validation command from a CI is the recommended approach.
{% /callout %}
After creating your custom launch template, it's recommended to validate it. This ensures that all necessary fields
within the launch template and all respective inputs within each step are appropriately defined.

To do this, run the `nx-cloud validate` command, with the path to the launch template:

```shell
nx-cloud validate --workflow-file=./.nx/workflows/agents.yaml
```

## Pass Environment Variables to Agents

If you need to send environment variables to agents, you can use the [--with-env-vars](/ci/reference/nx-cloud-cli#withenvvars-nx-agents-only) flag on the `nx-cloud start-ci-run` command. You can pass a specific list of environment variables like this:

```
nx-cloud start-ci-run --distribute-on="8 linux-medium-js" --with-env-vars="VAR1,VAR2"
```

Or pass all the environment variables except OS-specific ones with this `--with-env-vars="auto"`:

```
nx-cloud start-ci-run --distribute-on="8 linux-medium-js" --with-env-vars="auto"
```

## Pass Values Between Steps

If you need to pass a value from one step to another step, such as assigning the value to an existing or new environment variable. You can write to the `NX_CLOUD_ENV` environment file.

Commonly used for redefining the `PATH` or setting options for tooling.

```yaml {% fileName="./nx/workflows/agents.yaml" %}
launch-templates:
  my-template-name:
    init-steps:
      - name: Set PATH
        script: echo "PATH=$HOME/.cargo/bin:$PATH" >> $NX_CLOUD_ENV
      - name: Check PATH
        script: |
          # now contains $HOME/.cargo/bin
          echo $PATH 
          # can invoke cargo directly because it's in the PATH now. 
          cargo --version
```

## Private NPM Registry

If your project consumes packages from a private registry, you'll have to set up an authentication step in a custom launch template and authenticate like you normally would, usually this is via a `.npmrc` or `.yarnrc` file. You can pass the auth token from your main agent, so it's available to the agent machines.

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  my-linux-medium-js:
    resource-class: 'docker_linux_amd64/medium'
    image: 'ubuntu22.04-node20.11-v9'
    init-steps:
      - name: Checkout
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/checkout/main.yaml'
      - name: Auth to Registry
        script: |
          # create .npmrc with @myorg scoped packages pointing to GH npm registry
          echo "@myorg:registry=https://npm.pkg.github.com" >> .npmrc
          echo "//npm.pkg.github.com/:_authToken=${SOME_AUTH_TOKEN}" >> .npmrc
      - name: Install Node Modules
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/install-node-modules/main.yaml'
```

Pass `SOME_AUTH_TOKEN` via `--with-env-vars`

```
# this assumes SOME_AUTH_TOKEN is already defined on the main agent
nx-cloud start-ci-run --distribute-on="5 my-linux-medium-js" --with-env-vars="SOME_AUTH_TOKEN"
```

## Custom Node Version

Nx Agents come with node LTS installed. If you want to use a different version, you can add a step to install the desired node version.

{% tabs %}
{% tab label="Pre-Built Step" %}

Nx Cloud provides a [pre-built step to install a custom node version](https://github.com/nrwl/nx-cloud-workflows/tree/main/workflow-steps/install-node) within your workflow. This step is available as of `v4` of the workflow steps and requires the minimum image version to be `ubuntu22.04-node20.11-v9`.

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  node-21:
    resource-class: 'docker_linux_amd64/medium'
    # note the image version of v9,
    # earlier versions of the base image will not work
    image: 'ubuntu22.04-node20.11-v9'
    init-steps:
      - name: Checkout
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/checkout/main.yaml'
      - name: Install Node
        # note the step is only released as of v4 of the workflow steps
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/install-node/main.yaml'
        inputs:
          # can omit value if a '.nvmrc' file is within the root of the repo
          node_version: '21'
```

{% /tab %}
{% tab label="Manual Installation" %}

Here is a simplified launch template manually installing [nvm](https://github.com/nvm-sh/nvm) to manage different node version.
Feel free to use your preferred tool, other popular options are [volta](https://volta.sh/) or [fnm](https://github.com/Schniz/fnm).
The steps follow the general pattern of:

1. install tool
1. install node with tool
1. persist any environment variable changes for future steps

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  node-21:
    resource-class: 'docker_linux_amd64/medium'
    image: 'ubuntu22.04-node20.11-v9'
    init-steps:
      - name: Checkout
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/checkout/main.yaml'
      - name: Install nvm
        script: |
          # run nvm install script
          curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
          # source the updated profile to get the nvm command available
          source ~/.profile
          # install the needed version of node via nvm
          nvm install 21.7.3
          # echo the current path (which now includes the nvm-provided version of node) to NX_CLOUD_ENV
          echo "PATH=$PATH" >> $NX_CLOUD_ENV
      - name: Print node version
        # confirm that the node version has changed
        script: node -v
      - name: Install Node Modules
        uses: 'nrwl/nx-cloud-workflows/v4/workflow-steps/install-node-modules/main.yaml'
      # Continue setup steps as needed
```

{% /tab %}
{% /tabs %}

## Specific Package Manager Version

Nx Agents have [corepack enabled](https://nodejs.org/api/corepack.html#corepack) by default, allowing you to define the yarn or pnpm version via the `package.json`.

```json {% fileName="package.json" %}
{
  "packageManager": "yarn@4.1.1"
}
```

{% callout type="note" title="Supported Package Managers" %}
Currently, corepack [only supports yarn or pnpm](https://nodejs.org/api/corepack.html#supported-package-managers) as package managers. If you need to use a specific npm version, you will need to create a custom launch template and install the specific npm version, i.e. `npm install -g npm@<version>`
{%/callout %}

## Installing Packages on Nx Agents

You can use `apt` to install popular linux packages. This is helpful in streamlining setting up various toolchains needed for your workspace.

For example, you can install the [GitHub CLI](https://cli.github.com/) on the agents if needed.

```yaml {% fileName="./nx/workflows/agents.yaml" %}
launch-templates:
  my-linux-medium-js:
    resource-class: 'docker_linux_amd64/medium'
    image: 'ubuntu22.04-node20.11-v9'
    init-steps:
      - name: Install Extras
        script: |
          sudo apt install gh unzip zip -y
```

{% callout type="note" title="Installing without apt" %}
If you're trying to install a package that isn't available on `apt`, check that packages install steps for Debian base linux. Usually there are a handful of installation scripts that can be used [similar to `nvm`](#custom-node-version)
{% /callout %}

## Dynamic Changesets

NxCloud can calculate how big your pull request is based on how many projects in your workspace it affects. You can then configure Nx Agents to dynamically use a different number of agents based on your changeset size.

Here we define a `small`, `medium` and `large` distribution strategy:

```yaml {% fileName=".nx/workflows/dynamic-changesets.yaml" %}
distribute-on:
  small-changeset: 3 linux-medium-js
  medium-changeset: 8 linux-medium-js
  large-changeset: 12 linux-medium-js
```

Then you can pass the path to the file to the `--distribute-on` parameter.

```
nx-cloud start-ci-run --distribute-on=".nx/workflows/dynamic-changesets.yaml"
```

## Debugging

You can add steps to your template which print information about your workspace, toolchains, or any other needs.
Below are some common steps people use for debugging such as running nx commands, printing file contents and/or listing directory contents.

{% callout type="caution" title="Environment Variables" %}
Exercise caution when printing out environment variables, they will be shown in plain text.
{% /callout %}

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  my-linux-medium-js:
    resource-class: 'docker_linux_amd64/medium'
    image: 'ubuntu22.04-node20.11-v9'
    env:
      # enable verbose logging for all steps
      NX_VERBOSE_LOGGING: true
    init-steps:
      - name: 'Debug: Print Nx Report'
        script: |
          nx report
      - name: 'Debug: List Directory Contents'
        script: |
          echo $HOME
          ls -la $HOME
          output_dir=$HOME/dist
          # if output directory exists list it's contents
          if [ -d output_dir ]; then
            ls -la $output_dir
          else
            echo "$output_dir does not exist"
          fi
      - name: 'Debug: Show File Contents'
        script: |
          cat $HOME/.profile
      - name: 'Debug: Check For Checkout Files'
        script: |
          git diff
      - name: 'Debug: Print Versions'
        script: |
          # note if you use yarn and try to run pnpm, corepack might throw an error at you
          # saying you're using the wrong package manager, in that case just remove the usage of pnpm
          echo "Versions:"
          echo "Node: $(node -v)"
          echo "NPM: $(npm -v)"
          echo "Yarn: $(yarn -v)"
          echo "PNPM: $(pnpm -v)"
          echo "Golang: $(go version)"
          echo "Java: $(javac --version)"
          # add any other toolchain you want
      - name: 'Debug: Print env'
        script: |
          # !!! DO NOT RUN THIS IF YOU HAVE PASSWORD/ACCESS TOKENS IN YOUR ENV VARS !!!
          # this will print your env as plain text values to the terminal
          env  
          # This is a safer approach to prevent leaking tokens/passwords
          echo "SOME_VALUE: $SOME_VALUE"
```
