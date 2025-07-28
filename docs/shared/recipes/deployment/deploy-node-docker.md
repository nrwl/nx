---
title: Deploy Node.js Apps with Docker
description: Learn how to containerize Node.js applications in Nx monorepos with optimized Docker builds, calendar versioning, and automated deployment workflows.
---

# Deploy Node.js Apps with Docker

{% callout type="warning" title="Experimental Feature" %}
Docker support in Nx is currently experimental and may undergo breaking changes without following semantic versioning.
{% /callout %}

This guide walks you through deploying Node.js applications with Docker in an Nx workspace, from initial setup to publishing images to Docker Hub.

## Prerequisites

- Nx workspace with Node.js applications
- Docker Desktop or Docker Engine installed
- Docker Hub account (or other registry access)

## Create a New Workspace with Docker

Create a new Nx workspace with a Node.js application that includes Docker support:

```shell
npx create-nx-workspace@latest myorg --preset=node-monorepo
cd myorg
nx g @nx/node:app api --docker
```

This generates:
- A Node.js application with production-ready configuration
- A multi-stage Dockerfile optimized for monorepos
- Inferred Docker targets for building and running containers

## Add Docker to an Existing Application

For existing Node.js applications, add Docker support:

```shell
# Install the Docker plugin
nx add @nx/docker

# Add Docker to your application
nx g @nx/node:setup-docker my-api
```

This creates an optimized Dockerfile and configures the necessary build settings.

## Understanding the Generated Dockerfile

The generated Dockerfile uses a multi-stage build optimized for Nx monorepos:

```dockerfile
# Stage 1: Build the application
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx nx build api

# Stage 2: Create the production image
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY --from=builder /app/dist/apps/api ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
RUN npm ci --production
CMD ["node", "main.js"]
```

## Optimizing Docker Builds

### Enable Lockfile Pruning

Nx automatically prunes your lockfile to include only the dependencies needed by your application:

```json {% fileName="apps/api/project.json" %}
{
  "targets": {
    "build": {
      "executor": "@nx/js:node",
      "options": {
        "outputPath": "dist/apps/api",
        "main": "apps/api/src/main.ts",
        "generatePackageJson": true,
        "pruneLockfile": true
      }
    }
  }
}
```

This reduces Docker image size by excluding unnecessary dependencies from other projects in the monorepo.

### Handle Workspace Dependencies

If your application depends on workspace libraries, use the `copy-workspace-modules` executor:

```shell
nx copy-workspace-modules api
```

This copies local workspace modules into the build output, making them available in the Docker build context.

## Building and Running Docker Images

### Build the Docker Image

```shell
# Build the application first
nx build api

# Build the Docker image
nx docker:build api
```

The Docker plugin automatically infers the image name from your project structure.

### Run the Container Locally

```shell
nx docker:run api
```

This starts your containerized application with appropriate port mappings.

## Setting Up Docker Release

Configure Nx Release to manage Docker image versioning and publishing:

### 1. Configure Docker in nx.json

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "docker": {
      "repositoryName": "myorg",
      "registryUrl": "docker.io",
      "versionSchemes": {
        "production": "{currentDate|YYMM.DD}.{shortCommitSha}",
        "staging": "{currentDate|YYMM.DD}-staging"
      }
    }
  }
}
```

### 2. Configure Project-Level Settings

```jsonc {% fileName="apps/api/project.json" %}
{
  "release": {
    "docker": {
      "repositoryName": "myorg/api"
    }
  }
}
```

## Publishing to Docker Hub

### 1. Authenticate with Docker Hub

```shell
docker login
```

### 2. Release with Calendar Versioning

```shell
# Build and tag images with production version scheme
nx release version --dockerVersionScheme=production

# Push images to registry
nx release publish
```

This creates tags like `myorg/api:2501.24.a1b2c3d` based on the current date and commit SHA.

## CI/CD Integration

### GitHub Actions Example

```yaml {% fileName=".github/workflows/docker-deploy.yml" %}
name: Deploy Docker Images

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
          
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 20
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build affected applications
        run: npx nx affected -t build
        
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}
          
      - name: Build and push Docker images
        run: npx nx release --dockerVersionScheme=production
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Using Custom Registries

### GitHub Container Registry

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "docker": {
      "registryUrl": "ghcr.io",
      "repositoryName": "${{ github.repository_owner }}"
    }
  }
}
```

### AWS ECR

```jsonc {% fileName="nx.json" %}
{
  "release": {
    "docker": {
      "registryUrl": "123456789012.dkr.ecr.us-east-1.amazonaws.com",
      "repositoryName": "myorg"
    }
  }
}
```

## Best Practices

### 1. Use Multi-Stage Builds

Always use multi-stage builds to minimize image size:
- Build stage: Contains build tools and development dependencies
- Production stage: Contains only runtime dependencies

### 2. Optimize Layer Caching

Order Dockerfile commands from least to most frequently changing:
1. Base image and system dependencies
2. Package files (package.json, lockfile)
3. Dependencies installation
4. Application code

### 3. Security Scanning

Add security scanning to your CI pipeline:

```yaml
- name: Scan Docker image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'myorg/api:latest'
    format: 'sarif'
    output: 'trivy-results.sarif'
```

### 4. Use `.dockerignore`

Create a `.dockerignore` file to exclude unnecessary files:

```
node_modules
.git
.nx
dist
tmp
*.log
```

## Troubleshooting

### Large Image Sizes

If your images are unexpectedly large:
1. Ensure `generatePackageJson` is enabled in your build target
2. Verify lockfile pruning is working: check `dist/apps/api/package-lock.json`
3. Use `docker history` to analyze layer sizes

### Workspace Dependencies Not Found

If workspace dependencies fail in Docker:
1. Run `nx copy-workspace-modules api` after building
2. Ensure the Dockerfile copies the `workspace_modules` directory
3. Check that `generatePackageJson` includes workspace dependencies

### Build Context Too Large

If Docker complains about the build context:
1. Add more entries to `.dockerignore`
2. Consider using a more specific build context path
3. Use Docker BuildKit for improved performance

## Next Steps

- Learn about [Nx Release](/features/manage-releases) for automated versioning
- Explore [CI/CD publishing workflows](/recipes/nx-release/publish-in-ci-cd)
- Read about [optimizing Node.js containers](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- Configure [Docker Compose](https://docs.docker.com/compose/) for multi-container applications