---
title: 'Seamless Java Deployment in Nx Using Docker'
slug: seamless-deploys-with-docker
authors: ['Mike Hartington']
tags: ['nx', 'java', 'docker']
cover_image: /blog/images/2025-07-31/header.avif
description: 'Learn how to package, run, and deploy a Java backend from an Nx monorepo using the new Nx Docker plugin—automating builds, streamlining releases, and shipping production-ready containers.'
youtubeUrl: https://youtu.be/pbAQErStl9o
---

{% callout type="deepdive" title="Java Week Series" expanded=true %}

This article is part of the Java Week series:

- [The Journey of Nx Gradle](/blog/journey-of-nx-gradle)
- [Polyglot Projects Made Easy](/blog/spring-boot-with-nx)
- [Getting Mobile Into Your Monorepo](/blog/android-and-nx)
- **Seamless Deploys With Docker**

{% /callout %}

We've exlored how you can add a Java app to an existing Nx workspace, but just getting the code in the same place doesn't really help _ship_ our code. With JavaScript apps, you simple need to have a static hosting provider or have a platform that can run node. But Java? Where do you even begin? Let's look at how we can get our Java backend deployed and automate it using Nx. We'll also get a sneak peek at a new plugin we've been working on.

## The Challenge: From Monorepo to Production

Running both the front-end and back-end within an Nx workspace is straightforward. But when it comes time to deploy your backend to a live URL, questions arise:

- How do we package and deploy a Java application from the monorepo?
- Do we need a hosting provider that supports Java by default?
- How do we ensure consistent environments across different platforms?

The solution: Docker.

Docker allows us to encapsulate our backend into an image, ensuring that it will run consistently across AWS, GCP, or any other provider. By combining Docker with `nx release`, we can:

- Automate the creation of Docker images for the backend.
- Ensure builds are consistent and reproducible.
- Push images directly to registries like Docker Hub for deployment.

The upcoming `@nx/docker` plugin takes this a step further, letting you define Docker workflows natively within Nx.

## Setting Up a Dockerfile for the Backend

To get started, we create a `Dockerfile` inside the Java backend directory of the Nx workspace. This file tells Docker how to build and run our application:

```
FROM openjdk:26-slim-bullseye
MAINTAINER baeldung.com
EXPOSE 3000
COPY build/libs/java-backend-0.0.1-SNAPSHOT.jar app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
```

1. **Base Image:** Use `openjdk:26` as the starting point.
2. **Expose Ports:** Our backend runs on port `3000`, so we expose this port for the container.
3. **Copy the Build Artifact:** Copy the generated `.jar` file into the container as `app.jar`.
4. **Set the Entry Point:** Run the app with `java -jar app.jar`.

This simple setup ensures that the container will spin up our backend just like we would run it locally. Now, we can manually run Docker ourselves from the command line, but we have Nx here, and it can do that for us. Let's add the new Nx Docker plugin:

```bash
nx add @nx/docker
```

In my project, I need to setup some port forwarding, so that the port my Java app runs on, can be exposed when the Docker image is started.

```json
{
  "name": "java-backend",
  "root": "apps/java-backend",
  "projectType": "application",
  "targets": {
    "docker:run": {
      "options": {
        "args": ["-p", "3000:3000"]
      }
    }
  }
}
```

With this, `localhost:3000` will serve your API endpoints as if they were running directly on your machine.

Now with this new plugin, you can incorporate various Docker tasks in other parts of your Nx workflow, or as stand alone tasks. We can harness Nx’s task orchestration to build out a task pipeline. We can set `docker:build` to `dependsOn: ["build"]` and the `@nx/docker` plugin will already infer that `docker:run` `dependsOn: ["docker:build"]` ensuring that the docker image is available locally to run.

```bash
nx docker:run java-backend
```

All this from a simple command!

## Integrating Docker with Nx Release

Now creating and running a docker image is fine, but we want to coordinate this as part of a release so everything we built can be shipped together. This is where `nx release` comes in. Let's add a new `release` configuration in our `nx.json`:

```json
{
  "release": {
    "projects": ["java-backend"],
    "projectsRelationship": "independent",
    "releaseTagPattern": "release/{projectName}/{version}",
    "docker": {
      "skipVersionActions": true
    },
    "changelog": {
      "projectChangelogs": true
    }
  }
}
```

This is fairly standard release config, but the `docker` entry is new. The `skipVersionActions` tells Nx to not attempt to version any of the packages we’re releasing. Typically, this means bumping the version to the next major/minor/patch depending on your commits. Since this is just a demo, we don't really need worry about versioning any packages, just versioning the Docker image.

Then, we need to include some release configuration for to tell `nx release` about where we want our `java-backend` released to. Let's open the `project.json` and add a new release setup:

```json
{
  "name": "java-backend",
  "root": "apps/java-backend",
  "projectType": "application",
  "targets": {...},
  "release": {
    "docker": {
      "repositoryName": "nrwlmike/java-app"
    }
  }
}
```

The `repositoryName` is how `nx release` will know where it should upload the image to after it's ready. By default, this will publish to Docker Hub, but you can also set a `registryURL` to point it to your own private Docker registry if needed.

Now, it's time to ship it!

```bash
nx release --first-release
```

Nx will build, version, and publish your Docker image to Docker Hub.

## Deploying Anywhere

With the Docker image published, deployment becomes as simple as pointing any provider—AWS, GCP, or others—to your image. Your backend will spin up in a consistent, production-ready environment.

The Docker plugin is still experimental, but its integration into Nx’s existing build and release workflows makes deploying backends seamless. It takes care of the tedious steps, allowing you to focus on building features rather than managing deployment scripts.

If you're interested in know more, let us know! Join our community Discord and be on the look out for the official release of the Docker plugin.

---

Learn more:

- 🌌 [Nx Gradle Tutorial](/getting-started/tutorials/gradle-tutorial)
- 📖 [Nx Gradle API](/technologies/java/api)
- 📦 [Nx Release](/features/manage-releases)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
