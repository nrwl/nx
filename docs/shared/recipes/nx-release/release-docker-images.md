---
title: Release Docker Images
description: Learn how to use Nx Release to version and publish Docker images from your monorepo with calendar-based versioning.
---

# Release Docker Images

This guide walks you through setting up Nx Release to version and publish Docker images from your monorepo using calendar-based versioning.

{% youtube title="What is Nx?" src="https://www.youtube.com/embed/TOPxKJXUaqw" /%}

## Prerequisites

Before starting, ensure you have:

1. Docker installed and running locally
2. Run `docker login` to authenticate with your Docker registry (e.g., `docker login docker.io` for Docker Hub)

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
    "releaseTagPattern": "release/{projectName}/{version}",
    "groups": {
      "apps": {
        "projects": ["api"],
        "projectsRelationship": "independent",
        "docker": {
          // This should be true to skip versioning with other tools like NPM or Rust crates.
          "skipVersionActions": true,
          // You can also use a custom registry like `ghcr.io` for GitHub Container Registry.
          // `docker.io` is the default so you could leave this out for Docker Hub.
          "registryUrl": "docker.io",
          // The pre-version command is run before versioning, useful for verifying the Docker image.
          "groupPreVersionCommand": "echo BEFORE VERSIONING"
        },
        "changelog": {
          "projectChangelogs": true
        }
      }
    }
  }
}
```

The `release.groups.apps.docker.skipVersionActions` option should be set to `true` to skip versioning for other tooling such as NPM or Rust crates.

The `release.groups.apps.projectsRelationship` is set to `independent` and `release.groups.apps.changelog` is set to `projectChangelogs` so that each application within the group maintains its own release cadence and changelog.

The `release.groups.apps.docker.groupPreVersionCommand` is an optional command that runs before the versioning step, allowing you to perform any pre-version checks such as image verification before continuing the release.

## Set Up App Repository

Docker images have to be pushed to a repository, and this must be set on each application you want to release. This must be set as `release.docker.repositoryName` in the project's `project.json `or `package.json` file.

For example, from the previous `apps/api` Node.js application, you can set the `nx.release.docker.repositoryName` in `package.json`.

```json {% fileName="apps/api/package.json" highlightLines=["5-7"] %}
{
  "name": "@acme/api",
  "version": "0.0.1",
  "nx": {
    "release": {
      "docker": {
        "repositoryName": "acme/api"
      }
    }
    // ...
  }
}
```

Or if you don't have a `package.json` (e.g. for non-JS projects), set it in `project.json`:

```json {% fileName="apps/api/project.json" highlightLines=["5-7"] %}
{
  "name": "api",
  "root": "apps/api",
  "projectType": "application",
  "release": {
    "docker": {
      "repositoryName": "acme/api"
    }
  }
  // ...
}
```

You should replace `acme` with your organization or username for the Docker registry that you are logged into.

## Your First Docker Release

Dry run your first Docker release with calendar versioning:

```shell
nx release --dockerVersionScheme=production --first-release --dry-run
```

When you are ready, run the release command again without `--dry-run`:

```shell
nx release --dockerVersionScheme=production --first-release
```

When prompted to publish the image, choose `yes`, or you can pass the `--yes` flag to skip the prompt.

This will:

- Build your Docker images
- Tag them with a calendar version (e.g., `2501.01.a1b2c3d`)
- Update the app's changelog (e.g. `apps/api/CHANGELOG.md`)
- Update git tags (you can check with `git --no-pager tag --sort=-version:refname | head -5`)
- Push the image to the configured Docker registry (e.g., `docker.io/acme/api:2501.01.a1b2c3d`)

### Understanding Calendar Versioning

Calendar versions follow the pattern `YYMM.DD.SHA`:

- `YYMM`: Year and month
- `DD`: Day of the month
- `SHA`: Short commit hash

Note: The timezone is UTC to ensure consistency across different environments.

## Future Releases

After the first release, you can run `nx release` without the `--first-release` flag. If you do not specify `--dockerVersionScheme`, then you will be prompted to choose one:

- `production` - for regular releases from the `main` or stable branch
- `hotfix` - for bug fixes from a hotfix branch

These are the default schemes that come with Nx Release. These schemes support workflows where you have a stable branch that developers continuously integrate with, and a hotfix branch reserved for urgent production fixes.

### Using Explicit Docker Versions

If you need to specify an exact Docker version instead of using version schemes, you can use the `--dockerVersion` flag:

```shell
nx release --dockerVersion=1.2.3
```

This will bypass the version scheme logic entirely and tag your Docker images with the exact version you specify. This is useful when you need to:

- Align Docker versions with external versioning systems
- Override the calendar-based versioning for specific releases
- Set custom version tags that don't follow the standard patterns

### Customizing Version Schemes

You can customize Docker version schemes in your `nx.json` to match your deployment workflow. The version patterns support several interpolation tokens:

```json {% fileName="nx.json" %}
{
  "release": {
    "dockerVersionScheme": {
      "production": "{currentDate|YYMM.DD}.{shortCommitSha}",
      "staging": "{currentDate|YYMM.DD}-staging.{shortCommitSha}",
      "ci": "{env.BUILD_NUMBER}-{shortCommitSha}"
    }
  }
}
```

The above configuration swaps `hotfix` scheme for `staging` and adds a `ci` scheme that uses an environment variable. You can customize this list to fit your needs, and you can also change the patterns for each scheme.

Version patterns can include environment variables using the `{env.VAR_NAME}` syntax, allowing you to inject CI/CD pipeline information like build numbers or deployment environments directly into your Docker tags.

See the [`docker.versionScheme` documentation](/reference/nx-json#version-scheme-syntax) for more details on how to customize the tag pattern.
