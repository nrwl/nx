# Configuring CI Using Bitbucket Pipelines and Nx

Below is an example of an Bitbucket Pipelines, building and testing only what is affected. 

```yaml {% fileName="bitbucket-pipelines.yml" %}
image: node:20
pipelines:
  pull-requests:
    '**':
      - step:
          name: 'Build and test affected apps on Pull Requests'
          caches: # optional
            - node
          script:
            - npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js" --stop-agents-after="build" # this line enables distribution
            - npm ci
            - npx nx-cloud record -- nx format:check
            - npx nx affected -t lint test build --base=origin/master --head=HEAD

  branches:
    main:
      - step:
          name: "Build and test affected apps on 'main' branch changes"
          caches: # optional
            - node
          script:
            - npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js" --stop-agents-after="build" # this line enables distribution
            - npm ci
            - npx nx-cloud record -- nx format:check
            - npx nx affected -t lint test build --base=HEAD~1
```

The `pull-requests` and `main` jobs implement the CI workflow.
