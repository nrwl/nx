group = "dev.nx"

plugins {
    // Apply the org.jetbrains.kotlin.jvm Plugin to add support for Kotlin.
    id("org.jetbrains.kotlin.jvm") version "2.1.10"

    // Apply the application plugin to add support for building a CLI application in Java.
    application

    id("com.github.johnrengelman.shadow") version "8.1.1"
}

repositories {
    // Use Maven Central for resolving dependencies.
    mavenCentral()
    maven {
        url = uri("https://repo.gradle.org/gradle/libs-releases/")
    }
}

dependencies {
    val toolingApiVersion = "8.13" // Match the Gradle version you're working with

    implementation("org.gradle:gradle-tooling-api:$toolingApiVersion")
    runtimeOnly("org.slf4j:slf4j-simple:1.7.10")
    implementation("com.google.code.gson:gson:2.10.1")
}

// Apply a specific Java toolchain to ease working on different environments.
java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

application {
    // Define the main class for the application.
    mainClass.set("dev.nx.gradle.NxBatchRunnerKt")
}


tasks.jar {
    manifest {
        attributes["Main-Class"] = "dev.nx.gradle.NxBatchRunnerKt"
    }
}

tasks.named<com.github.jengelman.gradle.plugins.shadow.tasks.ShadowJar>("shadowJar") {
    archiveBaseName.set("nx-batch-runner")
    archiveClassifier.set("") // No classifier -> produces nx-batch-runner.jar
    archiveVersion.set("")

    manifest {
        attributes["Main-Class"] = "dev.nx.gradle.NxBatchRunnerKt"
    }
}

tasks.build {
    dependsOn(tasks.shadowJar)
}