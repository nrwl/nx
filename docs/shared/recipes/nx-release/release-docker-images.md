---
title: Release Docker Images
description: Learn how to use Nx Release to version and publish Docker images from your monorepo with calendar-based versioning.
---

# Release Docker Images

{% callout type="warning" title="Docker is Experimental" %}
Docker support in Nx Release is currently experimental and only available in the `next`/beta version. It may undergo breaking changes without following semantic versioning.
{% /callout %}

This guide walks you through setting up Nx Release to version and publish Docker images from your monorepo using calendar-based versioning.

## Prerequisites

Before starting, ensure you have:

1. Docker installed and running locally
2. Make sure that you are on the `next`/beta version of Nx and Nx plugins

## Install Nx Docker Plugin

```shell
nx add @nx/docker
```

This command adds the `@nx/docker` plugin to your `nx.json` so that projects with a `Dockerfile` is automatically configured with Docker targets (e.g. `docker:build` and `docker:run`).

## (Optional) Create Basic Node.js Backend

If you don't already have a backend application, create one using `@nx/node`:

```shell
nx add @nx/node
nx g @nx/node:app apps/api --docker --framework=express
```

This generates a Node.js application with a Dockerfile like the following:

```dockerfile {% fileName="apps/api/Dockerfile" %}
FROM docker.io/node:lts-alpine

ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app

RUN addgroup --system api && \
adduser --system -G api api

COPY dist app/
COPY package.json app/
RUN chown -R api:api .

# You can remove this install step if you build with `--bundle` option.
# The bundled output will include external dependencies.
RUN npm --prefix api --omit=dev -f install

CMD [ "node", "app" ]
```

You should be able to run the following commands to compile the application and create a Docker image:

```shell
nx build api
nx docker:build api
```

## Set Up a New Release Group

Configure Docker applications in a separate release group called `apps` so it does not conflict with any existing release projects.

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "releaseTagPattern": {
      "pattern": "release/{projectName}/{version}"
    },
    "groups": {
      "apps": {
        "projects": ["api"],
        "projectsRelationship": "independent",
        "docker": {
          "skipVersionActions": true
        },
        "changelog": {
          "projectChangelogs": true
        }
      }
    }
  }
}
```

The `docker.projectsRelationship` is set to `indepdendent` and `docker.changelog` is set to `projectChangelogs` so that each application maintains has its own release cadence and changelog.

The `docker.skipVersionActions` option should be set to `true` to skip versioning for other tooling such as NPM or Rust crates.

## Your First Docker Release

Dry run your first Docker release with calendar versioning:

```shell
nx release --dockerVersionScheme=production --first-release --dry-run
```

When you are ready, run the release command again without `--dry-run`:

```
nx release --dockerVersionScheme=production --first-release
```

When prompted, choose to release the version.

This will:

- Build your Docker images
- Tag them with calendar versions (e.g., `2501.24.a1b2c3d`)
- Update git tags

## Understanding Calendar Versioning

Calendar versions follow the pattern `YYWW.BUILD.SHA`:

- `YYWW`: Year and week number (e.g., 2501 = 2025, week 01)
- `BUILD`: Build number for that week
- `SHA`: Short commit hash

Example: `2501.24.a1b2c3d`

This scheme is ideal for continuous deployment where every commit is potentially releasable.

## Complete Release Workflow

For subsequent releases, use this workflow:

```shell
# All-in-one command
nx release --dockerVersionScheme=production

# Or step by step
nx release version production
nx release changelog
nx release publish
```

## CI/CD Example

Here's a GitHub Actions workflow for automated Docker releases:

```yaml {% fileName=".github/workflows/docker-release.yml" %}
name: Docker Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Install dependencies
        run: npm ci

      - name: Create Release
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

          nx release --dockerVersionScheme=production --yes
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Best Practices

1. **Always use `--dry-run` first** when testing new configurations
2. **Use calendar versioning** for Docker images instead of semantic versioning
3. **Tag both `latest` and versioned** images for flexibility
4. **Automate in CI** to ensure consistent releases
5. **Use multi-stage builds** in your Dockerfiles for smaller images

## Troubleshooting

### Build Failures

If Docker builds fail during versioning:

```shell
# Debug with verbose output
nx release version --dockerVersionScheme=production --verbose

# Test Docker build independently
nx run api:docker:build
```

### Registry Authentication

Ensure you're authenticated to your registry:

```shell
# Test push manually
docker push my-org/api:test
```

### Version Tag Issues

If version interpolation isn't working, check:

1. Your `tags` configuration uses `{version}` placeholder
2. The `dockerVersionScheme` flag is specified
3. Git tags are being created correctly

## Next Steps

- Learn about [Docker registry setup](/recipes/nx-release/setup-docker-registry)
- Configure [automated releases in CI](/recipes/nx-release/publish-in-ci-cd)
