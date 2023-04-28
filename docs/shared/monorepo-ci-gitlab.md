# Configuring CI Using GitLab and Nx

Below is an example of a GitLab pipeline setup for an Nx workspace - building and testing only what is affected.

```yaml
image: node:18

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

variables:
  GIT_DEPTH: 0

format-check:
  stage: test
  extends: .distributed
  script:
    - npx nx format:check --base=$NX_BASE --head=$NX_HEAD

lint:
  stage: test
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint --parallel=3

test:
  stage: test
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD -t test --parallel=3 --configuration=ci

build:
  stage: build
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD -t build --parallel=3
```

The `build` and `test` jobs implement the CI workflow using `.distributed` as a template to keep the CI configuration file more readable.

{% nx-cloud-section %}

## Distributed CI with Nx Cloud

Read more about [Distributed Task Execution (DTE)](/core-features/distribute-task-execution).

```yaml
image: node:18

# Creating template for DTE agents
.dte-agent:
  interruptible: true
  cache:
    key:
      files:
        - yarn.lock
    paths:
      - '.yarn-cache/'
  script:
    - yarn install --cache-folder .yarn-cache --prefer-offline --frozen-lockfile
    - yarn nx-cloud start-agent
  artifacts:
    expire_in: 5 days
    paths:
      - dist

# Creating template for a job running DTE (orchestrator)
.base-pipeline:
  interruptible: true
  only:
    - main
    - merge_requests
  cache:
    key:
      files:
        - yarn.lock
    paths:
      - '.yarn-cache/'
  before_script:
    - yarn install --cache-folder .yarn-cache --prefer-offline --frozen-lockfile
    - NX_HEAD=$CI_COMMIT_SHA
    - NX_BASE=${CI_MERGE_REQUEST_DIFF_BASE_SHA:-$CI_COMMIT_BEFORE_SHA}

# Main job running DTE
nx-dte:
  stage: affected
  extends: .base-pipeline
  script:
    - yarn nx-cloud start-ci-run --stop-agents-after="build"
    - yarn nx-cloud record -- yarn nx format:check --base=$NX_BASE --head=$NX_HEAD
    - yarn nx affected --base=$NX_BASE --head=$NX_HEAD -t lint --parallel=3 & yarn nx affected --base=$NX_BASE --head=$NX_HEAD -t test --parallel=3 --configuration=ci & yarn nx affected --base=$NX_BASE --head=$NX_HEAD -t e2e --parallel=3 & yarn nx affected --base=$NX_BASE --head=$NX_HEAD -t build --parallel=3

# Create as many agents as you want
nx-dte-agent1:
  extends: .dte-agent
  stage: affected
nx-dte-agent2:
  extends: .dte-agent
  stage: affected
nx-dte-agent3:
  extends: .dte-agent
  stage: affected
```

{% /nx-cloud-section %}
