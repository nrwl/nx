---
title: 'Setup Docker Registry Publishing'
description: 'Learn how to configure Nx Release for versioning and publishing Docker images to container registries.'
---

# Setup Docker Registry Publishing

{% callout type="warning" title="Docker is Experimental" %}
Docker support in Nx Release is currently experimental and may undergo breaking changes without following semantic versioning.
{% /callout %}

This guide covers how to configure Nx Release for versioning and publishing Docker images to container registries.

## Docker Version Schemes

Unlike NPM packages that use semantic versioning, Docker images often use calendar-based versioning for continuous deployment workflows. Nx Release supports this with the `--dockerVersionScheme` flag.

### Calendar Versioning

Calendar versioning creates versions like `2501.24.a1b2c3d` based on:

- Year and week number (2501 = 2025, week 01)
- Build number for the week (24)
- Short commit SHA (a1b2c3d)

```shell
# Generate calendar-based version for Docker images
nx release version --dockerVersionScheme=production
```

## Configuration

### Basic Docker Configuration

Configure Docker releases in your `nx.json`:

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "releaseTagPattern": {
      "pattern": "release/{projectName}/{version}"
    },
    "groups": {
      "docker-apps": {
        "projects": ["api", "web-app"],
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

### Key Configuration Options

- **`skipVersionActions`**: Set to `true` for projects that shouldn't have their package.json versions updated
- **`projectsRelationship`**: Use `"independent"` for Docker projects that version independently
- **`releaseTagPattern`**: Customize git tags for Docker releases (e.g., `release/api/2501.24.a1b2c3d`)

## Build Configuration

### Configure Docker Build Target

Ensure your projects have a `docker:build` target that builds and tags images:

```jsonc {% fileName="apps/api/project.json" %}
{
  "targets": {
    "docker:build": {
      "executor": "@nx/docker:build",
      "options": {
        "context": ".",
        "dockerfile": "apps/api/Dockerfile",
        "tags": ["myregistry.com/api:latest", "myregistry.com/api:{version}"]
      }
    }
  }
}
```

### Pre-version Build Commands

Configure Nx Release to build Docker images before versioning:

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "version": {
      "preVersionCommand": "nx run-many -t docker:build"
    }
  }
}
```

## Publishing to Registries

### Docker Hub

For Docker Hub, ensure you're logged in:

```shell
docker login
```

### Private Registries

For private registries like AWS ECR, Google Container Registry, or Azure Container Registry:

```shell
# AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Google Container Registry
gcloud auth configure-docker

# Azure Container Registry
az acr login --name myregistry
```

### Publish Configuration

Configure the publish step to push Docker images:

```jsonc {% fileName="apps/api/project.json" %}
{
  "targets": {
    "nx-release-publish": {
      "executor": "@nx/release:publish",
      "options": {
        "command": "docker push myregistry.com/api:{version}"
      }
    }
  }
}
```

## Complete Workflow Example

Here's a complete example workflow for Docker releases:

```shell
# 1. Build and tag Docker images with calendar version
nx release version --dockerVersionScheme=production

# 2. Generate changelogs
nx release changelog

# 3. Push images to registry
nx release publish
```

## CI/CD Integration

For automated Docker releases in CI:

```yaml {% fileName=".github/workflows/release.yml" %}
name: Release Docker Images
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Install dependencies
        run: npm ci

      - name: Release
        run: |
          nx release version --dockerVersionScheme=production
          nx release changelog
          nx release publish
```

## Best Practices

1. **Use Calendar Versioning**: For continuous deployment, calendar versioning provides better traceability than semantic versioning
2. **Tag Multiple Versions**: Always tag both specific versions and `latest` for flexibility
3. **Automate in CI**: Docker releases work best when fully automated in your CI pipeline
4. **Separate from NPM**: Keep Docker releases in separate release groups from NPM packages

## Troubleshooting

### Common Issues

1. **Build failures**: Ensure Docker daemon is running and Dockerfile paths are correct
2. **Push authorization**: Verify registry authentication is configured correctly
3. **Tag conflicts**: Calendar versioning helps avoid tag conflicts in continuous deployment

### Debugging

Enable verbose output to troubleshoot:

```shell
nx release --verbose
```

## Next Steps

- Configure [release groups](/recipes/nx-release/release-projects-independently) for complex monorepos
- Set up [automated releases](/recipes/nx-release/automate-github-releases) with GitHub Actions
