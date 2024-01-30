# Configuring CI Using GitLab and Nx

Below is an example of an GitLab setup, building and testing only what is affected. 

```yaml {% fileName=".gitlab-ci.yml" %}
image: node:18

stages:
  - lint
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
    - npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js" --stop-agents-after="build" # this line enables distribution
    - npm ci --cache .npm --prefer-offline
    - NX_HEAD=$CI_COMMIT_SHA
    - NX_BASE=${CI_MERGE_REQUEST_DIFF_BASE_SHA:-$CI_COMMIT_BEFORE_SHA}

variables:
  GIT_DEPTH: 0

format-check:
  stage: test
  extends: .distributed
  script:
    - npx nx-cloud record -- nx format:check --base=$NX_BASE --head=$NX_HEAD

lint:
  stage: test
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint --parallel=3

test:
  stage: test
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD -t test --parallel=3 

build:
  stage: build
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD -t build --parallel=3
```
