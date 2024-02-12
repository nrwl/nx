# Launch Templates

You can find built-in launch templates [here](https://github.com/nrwl/nx-cloud-workflows/tree/main/launch-templates).

The easiest way to create a new custom launch template is to modify one of the built-in ones. To do that, create a file in the
`.nx/workflows` folder and copy one of the built-in templates there. You can name the file any way you want (e.g., `agents.yaml`).

This is an example of a launch template using all built-in features:

```yaml
launch-templates:
  my-linux-medium-js:
    resourceClass: 'docker_linux_amd64/medium'
    image: 'ubuntu22.04-node20.9-v3'
    env:
      MY_ENV_VAR: shared
    init-steps:
      - name: Checkout # using a reusable step
        uses: 'nrwl/nx-cloud-workflows/v1.1/workflow-steps/checkout/main.yaml'
      - name: Restore Node Modules Cache
        uses: 'nrwl/nx-cloud-workflows/v1.1/workflow-steps/cache/main.yaml'
        env:
          KEY: 'package-lock.json|yarn.lock|pnpm-lock.yaml'
          PATHS: 'node_modules'
          BASE_BRANCH: 'main'
      - name: Install Node Modules
        uses: 'nrwl/nx-cloud-workflows/v1.1/workflow-steps/install-node-modules/main.yaml'
      - name: Run a custom script
        script: |
          git config --global user.email test@test.com
          git config --global user.name "Test Test"
      - name: Setting env # Redefine PATH for further steps
        script: echo "PATH=$HOME/my-folder:$PATH" >> $NX_CLOUD_ENV
      - name: Print path
        script: echo $PATH # will include my-folder
      - name: Define env var for a step
        env: MY_ENV_VAR=for-step
        script: echo $MY_ENV_VAR # will print for-step
```

## Resource Classes

The following resource classes are available:

- `docker_linux_amd64/small`
- `docker_linux_amd64/medium`
- `docker_linux_amd64/medium+`
- `docker_linux_amd64/large`
- `docker_linux_amd64/large+`
- `docker_linux_amd64/extra_large`
- `docker_linux_amd64/extra_large+`
- `windows/medium`

See their detailed description and pricing at [nx.app/pricing](https://nx.app/pricing).

## Image

The following images are available:

- `ubuntu22.04-node20.9-v1`
- `ubuntu22.04-node20.9-withDind-v1`
- `ubuntu22.04-node20.9-v2`
- `ubuntu22.04-node20.9-withDind-v2`
- `ubuntu22.04-node20.9-v3`
- `ubuntu22.04-node20.9-withDind-v3`
- `windows-2022`

_Note: Windows-based images can only run on Windows-based resource classes._

Enterprise accounts can use custom images.

## Reusable Steps

You can find the list of reusable step [here](https://github.com/nrwl/nx-cloud-workflows/tree/main/workflow-steps).
