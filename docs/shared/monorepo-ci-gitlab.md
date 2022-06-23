# Configuring CI Using GitLab and Nx

Below is an example of a GitLab pipeline setup for an Nx workspace only building and testing what is affected.

```yaml
image: node:16

stages:
  - test
  - build

.distributed:
  interruptible: true
  only:
    - main
    - merge_requests
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - .npm/
  before_script:
    - npm ci --cache .npm --prefer-offline
    - NX_HEAD=$CI_COMMIT_SHA
    - NX_BASE=${CI_MERGE_REQUEST_DIFF_BASE_SHA:-$CI_COMMIT_BEFORE_SHA}
  artifacts:
    paths:
      - node_modules/.cache/nx

workspace-lint:
  stage: test
  extends: .distributed
  script:
    - npx nx workspace-lint --base=$NX_BASE --head=$NX_HEAD

format-check:
  stage: test
  extends: .distributed
  script:
    - npx nx format:check --base=$NX_BASE --head=$NX_HEAD

lint:
  stage: test
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD --target=lint --parallel=3

test:
  stage: test
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD --target=test --parallel=3 --ci --code-coverage

build:
  stage: build
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD --target=build --parallel=3
```

The `build` and `test` jobs implement the CI workflow using `.distributed` as template to keep CI configuration file more readable.

{% nx-cloud-section %}

## Distributed CI with Nx Cloud

In order to use distributed task execution, we need to start agents and set the `NX_CLOUD_DISTRIBUTED_EXECUTION` flag to `true`.

Read more about the [Distributed CI setup with Nx Cloud](/using-nx/ci-overview#distributed-ci-with-nx-cloud).

{% /nx-cloud-section %}
