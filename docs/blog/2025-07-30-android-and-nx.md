---
title: 'Getting Mobile Into Your Monorepo: Android + Nx'
slug: android-and-nx
authors: ['Mike Hartington']
tags: ['nx', 'java', 'android']
cover_image: /blog/images/2025-07-30/header.avif
description: 'Learn how to integrate an Android app using Kotlin and Jetpack Compose into an Nx monorepo, enabling full-stack builds and emulator deployment—all from the Nx CLI.'
---

{% callout type="deepdive" title="Java Week Series" expanded=true %}

This article is part of the Java Week series:

- [The Journey of Nx Gradle](/blog/journey-of-nx-gradle)
- [Polyglot Projects Made Easy](/blog/spring-boot-with-nx)
- **Getting Mobile Into Your Monorepo**

{% /callout %}

Ok, so we now have a Java project in our monorepo, sitting along side of our React frontend app. We can run each of these from the Nx CLI and have a really good experience. But we can take this further. Java isn't only just used for backend apps. You can use Java to build things like Android apps, and Android apps can be built via Gradle. So in theory you could have frontend, backend, and mobile all coming from one monorepo. Now, I'm going out on my own here. Nx doesn't have an official Nx plugin for native Android, but in a attempt to see what is possible, let's try it!

## Android Setup

Ok, we aren't going to be using Java completely, instead we're going to use Kotlin which runs on the JVM. Kotlin's major feature is Jetpack Compose, a declarative approach to building interfaces for Android apps. We can then use Gradle to manage our dependencies and build the final `apk` for installation. But to get started, we do need the IDE of choice for Android development, [Android Studio](https://developer.android.com/studio). Android Studio is built on top of IntelliJ so if you've that before, you should feel at home. The major changes here are to add some needed features to managing your Android SDK and virtual devices.

Once installed, we'll go through some setup which installs the Android SDK for us. When setup, we'll create a new project based on an Empty Activity template. A word of caution, there are several templates that are based on the older "Views" approach, which is an XML-based approach of building your UI. While this is still a valid way of building Android apps, Google has recommended folks use Jetpack Compose over the XML approach. Be sure to chose the templates that do no include "Views".

![](/blog/images/2025-07-30/template-picker.png)

From here, we do have a bit of work to prepare our project. Out of the box, Android Studio creates what is called a "multi-module" project. This is similar to a monorepo, as we could have multiple Java/Kotlin based apps or libraries in one repo. However, since our goal is to incorporate this into our previous monorepo, we need to consolidate this into a single module project. To do this, we're going to move some files around and merge our Gradle files for the project and for the `app` module.

> You really shouldn't need to do this, but for simplicity sake, we're doing it so we're not having to deal with Gradle's Composite Build.

Once built, let's just test a build inside of Android Studio to validate our app still builds and that Gradle has all the dependencies installed.

![](/blog/images/2025-07-30/android-studio.png)

## Bringing in Nx

From here, we can follow the same process we used when bringing our Spring Boot app over to an existing Nx workspace.

```shell
$ nx import ../mhartington/MyApplication

✔ Which branch do you want to import? · main
✔ Which directory do you want to import into this workspace? ·
? Where in this workspace should the code be imported into? › apps/android-frontend
```

Once imported, we do need to help Nx know about this project a bit more. For starter, we need a `project.json` in the root of the app:

```json {% fileName="project.json" %}
{
  "name": "android-frontend",
  "root": "apps/android-frontend",
  "projectType": "application"
}
```

Then we need to modify the `build.gradle.kt` to include the Nx Gradle plugin. This is currently a bug in the import process, so this is temporary. Remember, this isn't technically fully supported, so there be dragons:

```diff {% fileName="build.gralde.kt" %}
plugins {
+ id("dev.nx.gradle.project-graph") version "0.1.0"
  alias(libs.plugins.android.application)
  alias(libs.plugins.kotlin.android)
  alias(libs.plugins.kotlin.compose)
}

android {...}
dependencies {...}

+ allprojects {
+    apply {
+        plugin("dev.nx.gradle.project-graph")
+    }
+ }
```

Then one last thing is to cd into the project and run a Gradle build:

```shell
cd apps/android-frontend
./gradlew build
cd ../../

```

This just let's Gradle install the Nx plugin and sync all the dependencies.

## We Got Android, Now What?

Ok, that was a bit of work, but we're getting closer. From here we want to be able to deploy to an emulator from `nx`, so let's see what tasks we have available to use:

```shell
nx show project android-frontend
```

![](/blog/images/2025-07-30/android-tasks.png)

There are a lot of tasks in here, and most of them are not too relevant for us. How ever, I do know that there is a task we can run, and specifically an `installDebug` task.

![](/blog/images/2025-07-30/android-installdebug.png)

Behind the scenes, `installDebug` will build our app, and deploy it to any device or emulator we have running.

```shell
nx run android-frontend:installDebug
```

We do need to have an emulator open, so we can start one from Android Studio or if you have the Android SDK available from the command line, you can start it that way. With `installDebug` running, we should be able to see the app get installed to the emulator. We'll need to manually open it up, but it does install.

![](/blog/images/2025-07-30/nx-android.png)

## What’s Next

And that's it! It might seem not that impressive, but in the future, there could hypothetically be a dedicated Nx Android plugin that could handle starting your emulator and deploying your app. This could build on the Nx Gradle plugin and really help Android developers work more closely with their colleagues on the web team. We got one last blog post this week for our Java developers, so be sure to check back tomorrow and we'll get our app shipped 🚀.

---

Learn more:

- 🌌 [Nx Gradle Tutorial](/getting-started/tutorials/gradle-tutorial)
- 📖 [Nx Gradle API](/technologies/java/api)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
