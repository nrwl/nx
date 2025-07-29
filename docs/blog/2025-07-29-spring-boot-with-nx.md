---
title: 'Polyglot Projects Made Easy: Integrating Spring Boot into an Nx Workspace'
slug: spring-boot-with-nx
authors: ['Mike Hartington']
tags: ['nx', 'java', 'springboot']
cover_image: /blog/images/2025-07-29/header.avif
description: 'Learn how to seamlessly integrate a Spring Boot Java backend into an existing Nx monorepo with a React frontend—streamlining development, simplifying workflows, and enabling powerful fullstack coordination.'
youtubeUrl: https://youtu.be/FM2kAw-NNsQ
---

{% callout type="deepdive" title="Java Week Series" expanded=true %}

This article is part of the Java Week series:

- [The Journey of Nx Gradle](/blog/journey-of-nx-gradle)
- **Polyglot Projects Made Easy**

{% /callout %}

Behind every modern JavaScript app lies a powerful backend, and for many enterprises, that backend is powered by Java. At Nx, we believe Java is just as much a first-class citizen as JavaScript. While Nx has a proven history of streamlining JavaScript development, we also offer seamless integration for Java projects. With the `@nx/gradle` plugin, you can bring your Java services built with Gradle into your Nx monorepo, creating a unified environment where both frontend and backend thrive together. Let’s dive into how Nx bridges these worlds effortlessly.

## Spring into Java

For starters, let's look at our Java backend. It's just a simple app built using the Spring Boot framework. With this, we can set up various rest endpoints for interacting with some data. There's some endpoints for user management, authentication, and session storage for logged in users. For Java developers, running and testing this app is as simple as pressing the "play" button in IntelliJ.

![](/blog/images/2025-07-29/intellij.png)

Spring has [a project generator](https://start.spring.io/index.html) that can help get you up and running, and you can check out this project on GitHub if you want to follow along.

Now if I want to interact with this backend, I would need to create a frontend app that I can make request from. But in a real world situation, the frontend and backend are probably maintained by different teams. This is the typical problem space that Nx works in, so we can reduce and simplify the development of this app.

## You got your Java In my JavaScript

Our frontend project is just your standard React app. It already exists in a Nx workspace, so I have all of my usual Nx feature available to me. It interacts with the backend by making requests to it, but I need to start the two projects separately, which can just be cumbersome to manage.

![](/blog/images/2025-07-29/vscode.png)

To actually make these two projects work together, we can utilize the `nx import` command to start migrating the backend into the existing workspace. `import` can take a relative path or a git URL, and it will handle all of the necessary work of maintaining the git history, detecting the project type, and suggesting additional plugins you might want to include.

For our Java project, it's going to suggest that we include the `@nx/gradle` plugin as we are using [Gradle as our build system](https://gradle.org/). Once installed, we can run `nx graph` or `nx show project java-backend` to inspect.

![](/blog/images/2025-07-29/java-tasks.png)

Here we can see all of the available tasks from Gradle that we could run for our Java project. But how does Nx know about these tasks? We actually include a Gradle plugin for Nx that we use under the hood to inspect the Java project. When we call any `nx` command for our java project, we actually invoke Gradle in the background to get all of tasks that Gradle could run directly.

```groovy
plugins {
  id 'java'
  id 'org.springframework.boot' version '3.4.5'
  id 'io.spring.dependency-management' version '1.1.7'
  // Added by Nx
  id "dev.nx.gradle.project-graph" version "0.1.0"
}

java {...}
configurations {...}
repositories {...}
dependencies {...}

allprojects {
    apply {
        plugin("dev.nx.gradle.project-graph")
    }
}
```

This project-graph is added to our `build.gradle` file and is doing the real heavy lifting for us.

From here, we can start running the Java project

```bash
nx run java-backend:bootRun
```

And our API is up and running:

![](/blog/images/2025-07-29/backend-response.png)

## Connecting Two Tasks

With the project imported, we can now coordinate the frontend and backend processes so we can easily run them together. This is actually pretty easy to do thanks to `dependsOn`. In the `package.json` for our React app, let's configure the `dev` task and make it start the Java backend.

```json
{
  "name": "@mono-app/react-frontend",
  "version": "0.0.1",
  "private": true,
  "nx": {
    "targets": {
      "dev": {
        "dependsOn": ["java-backend:bootRun"]
      }
    }
  }
}
```

Now we can run `react-frontend:dev` and we'll automatically get our Java backend up and running

![](/blog/images/2025-07-29/react-java.png)

But we can take this one step further. Let's consider that we have a bug in our Java backend. A bad response from an endpoint, incorrect structure, or something similar. Since our code is all in one place, we could fix this easily, but to get the changes applied, we'll need to stop and restart our server. That's not ideal, and is super slow. So we can expand on that `dependsOn` approach from earlier within our Java backend project.

If we create a simple `project.json` in the java-backend directory, we'll be able to customize the `bootRun` task. For starters, we want `bootRun` to depend on the `build` task we have:

```json
{
  "targets": {
    "bootRun": {
      "dependsOn": ["build"]
    }
  }
}
```

Now for the build task, we want to pass in an argument to our underlying Gradle command:

```json
"build": {
  "continuous": true,
  "options": {
    "args": ["--continuous"]
  }
}
```

So we have the `options.args` passing in a `--continuous` flag and setting `"continuous": true`. Now, these look similar, but are doing two different things. The `"continuous": true` is telling Nx that this task is long-lived and will not end. The `options.args` part is getting passed to Gradle directly and telling Gradle to watch for file changes.

> For demo purposes, we're going to target the build task directly, but for more production ready example, create your own task so you do not impact any CI runs.

Now if we change one of our Java files, Gradle will rebuild our project, and the `bootRun` will refresh with the new changes applied.

![](/blog/images/2025-07-29/java-rebuilds.png)

## A Polyglot Future

With this, we have the beginnings of a great polyglot experience for teams that have a mix of languages. We can start to incorporate more Java related projects into Nx and bring all of the features that Nx has to offer. Be sure to stop by tomorrow to see what else we have in store for Java developers.

---

Learn more:

- 🌌 [Nx Gradle Tutorial](/getting-started/tutorials/gradle-tutorial)
- 📖 [Nx Gradle API](/technologies/java/api)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
