# Configuring CI Using Bitbucket Pipelines and Nx

Below is an example of a Bitbucket Pipeline setup for an Nx workspace - building and testing only what is affected.

```yaml
image: node:16
pipelines:
  pull-requests:
    '**':
      - step:
          name: 'Build and test affected apps on Pull Requests'
          caches: # optional
            - node
          script:
            - npm ci
            - npx nx format:check
            - npx nx affected -t lint --base=origin/master --parallel --max-parallel=3
            - npx nx affected -t test --base=origin/master --parallel --max-parallel=3 --configuration=ci
            - npx nx affected -t build --base=origin/master --head=HEAD --parallel  --max-parallel=3

  branches:
    main:
      - step:
          name: "Build and test affected apps on 'main' branch changes"
          caches: # optional
            - node
          script:
            - npm ci
            - npx nx format:check
            - npx nx affected -t lint --base=origin/master --parallel --max-parallel=3 & npx nx affected -t test --base=HEAD~1 --parallel --max-parallel=3 --configuration=ci & npx nx affected -t build --base=HEAD~1 --parallel  --max-parallel=3
```

The `pull-requests` and `main` jobs implement the CI workflow.
