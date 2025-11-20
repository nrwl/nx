group = "dev.nx.gradle"

plugins {
  // Apply the org.jetbrains.kotlin.jvm Plugin to add support for Kotlin.
  alias(libs.plugins.kotlin.jvm)
  // Apply the application plugin to add support for building a CLI application in Java.
  application
  alias(libs.plugins.shadow)
  alias(libs.plugins.ktfmt)
  alias(libs.plugins.nx.project.graph)
}

repositories {
  // Use Maven Central for resolving dependencies.
  mavenCentral()
  // need for gradle-tooling-api
  maven { url = uri("https://repo.gradle.org/gradle/libs-releases/") }
}

dependencies {
  implementation(libs.gradle.tooling.api)
  implementation(libs.kotlinx.coroutines.core)
  runtimeOnly(libs.slf4j.simple)
  implementation(libs.gson)
}

application {
  // Define the main class for the application.
  mainClass.set("dev.nx.gradle.NxBatchRunnerKt")
}

kotlin { jvmToolchain { languageVersion.set(JavaLanguageVersion.of(17)) } }
