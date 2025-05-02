group = "dev.nx.gradle"

plugins {
  // Apply the org.jetbrains.kotlin.jvm Plugin to add support for Kotlin.
  id("org.jetbrains.kotlin.jvm") version "2.1.10"
  // Apply the application plugin to add support for building a CLI application in Java.
  application
  id("com.github.johnrengelman.shadow") version "8.1.1"
  id("com.ncorti.ktfmt.gradle") version "+"
  id("dev.nx.gradle.project-graph") version "0.1.0"
}

repositories {
  // Use Maven Central for resolving dependencies.
  mavenCentral()
  // need for gradle-tooling-api
  maven { url = uri("https://repo.gradle.org/gradle/libs-releases/") }
}

dependencies {
  val toolingApiVersion = "8.13" // Match the Gradle version you're working with

  implementation("org.gradle:gradle-tooling-api:$toolingApiVersion")
  runtimeOnly("org.slf4j:slf4j-simple:1.7.10")
  implementation("com.google.code.gson:gson:2.10.1")
}

application {
  // Define the main class for the application.
  mainClass.set("dev.nx.gradle.NxBatchRunnerKt")
}

kotlin { jvmToolchain { languageVersion.set(JavaLanguageVersion.of(17)) } }

allprojects { apply { plugin("dev.nx.gradle.project-graph") } }
