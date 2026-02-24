plugins {
  `java-gradle-plugin`
  `maven-publish`
  signing
  alias(libs.plugins.ktfmt)
  alias(libs.plugins.nx.project.graph)
  alias(libs.plugins.kotlin.jvm)
  alias(libs.plugins.gradle.plugin.publish)
}

group = "dev.nx.gradle"

version = "0.1.12"

repositories { mavenCentral() }

dependencies {
  implementation(libs.gson)
  implementation(libs.javaparser.core)
  implementation(libs.kotlinx.coroutines.core)
  implementation(libs.jgit)
  // Use compileOnly to avoid runtime conflicts with Kotlin Gradle plugin
  compileOnly(libs.kotlin.compiler.embeddable) {
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-gradle-plugin")
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-gradle-plugin-api")
    exclude(group = "org.jetbrains.kotlin", module = "kotlin-gradle-plugin-idea")
  }
  testImplementation(libs.kotlin.test)
  testImplementation(libs.junit.jupiter)
}

java {
  withSourcesJar()
  withJavadocJar()
}

gradlePlugin {
  website = "https://nx.dev/"
  vcsUrl = "https://github.com/nrwl/nx"
  plugins {
    create("nxProjectGraphPlugin") {
      id = "dev.nx.gradle.project-graph"
      implementationClass = "dev.nx.gradle.NxProjectGraphReportPlugin"
      displayName = "The Nx Plugin for Gradle to generate Nx project graph"
      description = "Generates a JSON file with nodes, dependencies, and external nodes for Nx"
      tags = listOf("nx", "monorepo", "javascript", "typescript")
    }
  }
}

afterEvaluate {
  publishing {
    publications.named("pluginMaven", MavenPublication::class) {
      pom {
        name.set("Nx Gradle Project Graph Plugin")
        description.set(
            "A plugin to generate a JSON file with nodes, dependencies, and external nodes for Nx")
        url.set("https://github.com/nrwl/nx")

        licenses { license { name.set("MIT") } }

        developers {
          developer {
            id.set("nx")
            name.set("Nx")
            email.set("java-services@nrwl.io")
          }
        }

        scm {
          connection.set("scm:git:git://github.com/nrwl/nx.git")
          developerConnection.set("scm:git:ssh://github.com/nrwl/nx.git")
          url.set("https://github.com/nrwl/nx")
        }
      }
    }

    repositories {
      maven {
        name = "localStaging"
        url = uri(layout.buildDirectory.dir("staging"))
      }
    }
  }
  publishing {
    publications.named("nxProjectGraphPluginPluginMarkerMaven", MavenPublication::class) {
      pom {
        name.set("Nx Gradle Project Graph Plugin")
        description.set(
            "A plugin to generate a JSON file with nodes, dependencies, and external nodes for Nx")
        url.set("https://github.com/nrwl/nx")

        licenses { license { name.set("MIT") } }

        developers {
          developer {
            id.set("nx")
            name.set("Nx")
            email.set("java-services@nrwl.io")
          }
        }

        scm {
          connection.set("scm:git:git://github.com/nrwl/nx.git")
          developerConnection.set("scm:git:ssh://github.com/nrwl/nx.git")
          url.set("https://github.com/nrwl/nx")
        }

        repositories {
          maven {
            name = "localStaging"
            url = uri(layout.buildDirectory.dir("staging"))
          }
        }
      }
    }
  }

  val skipSign = project.findProperty("skipSign") == "true"
  if (!skipSign) {
    signing {
      sign(publishing.publications["pluginMaven"])
      sign(publishing.publications["nxProjectGraphPluginPluginMarkerMaven"])
    }
  }

  // Even if signing plugin was applied, we can prevent the sign tasks from running
  tasks.withType<Sign>().configureEach { onlyIf { !skipSign } }
}

tasks.test {
  useJUnitPlatform()

  // Diagnostic logging for CI XML test result write failures
  doFirst {
    val resultsDir = reports.junitXml.outputLocation.get().asFile
    val binResultsDir = binaryResultsDirectory.get().asFile
    logger.lifecycle("=== Test diagnostics (doFirst) ===")
    logger.lifecycle("JUnit XML output dir: $resultsDir")
    logger.lifecycle(
        "  exists=${resultsDir.exists()}, canWrite=${resultsDir.canWrite()}, isDirectory=${resultsDir.isDirectory}")
    logger.lifecycle("Binary results dir: $binResultsDir")
    logger.lifecycle(
        "  exists=${binResultsDir.exists()}, canWrite=${binResultsDir.canWrite()}, isDirectory=${binResultsDir.isDirectory}")
    logger.lifecycle("Build dir: ${project.layout.buildDirectory.get().asFile}")
    logger.lifecycle(
        "  exists=${project.layout.buildDirectory.get().asFile.exists()}, canWrite=${project.layout.buildDirectory.get().asFile.canWrite()}")

    // Check disk space
    val buildFile = project.layout.buildDirectory.get().asFile
    val root = if (buildFile.exists()) buildFile else project.projectDir
    logger.lifecycle("Disk space on ${root.absolutePath}:")
    logger.lifecycle(
        "  totalSpace=${root.totalSpace / (1024*1024)}MB, freeSpace=${root.freeSpace / (1024*1024)}MB, usableSpace=${root.usableSpace / (1024*1024)}MB")

    // List parent directory contents
    val parentDir = resultsDir.parentFile
    if (parentDir?.exists() == true) {
      logger.lifecycle("Parent dir contents (${parentDir.absolutePath}):")
      parentDir.listFiles()?.forEach {
        logger.lifecycle("  ${it.name} (dir=${it.isDirectory}, write=${it.canWrite()})")
      }
    }
  }

  doLast {
    val resultsDir = reports.junitXml.outputLocation.get().asFile
    logger.lifecycle("=== Test diagnostics (doLast) ===")
    logger.lifecycle("JUnit XML output dir after tests: $resultsDir")
    logger.lifecycle("  exists=${resultsDir.exists()}, canWrite=${resultsDir.canWrite()}")
    if (resultsDir.exists()) {
      logger.lifecycle("XML result files:")
      resultsDir.listFiles()?.forEach {
        logger.lifecycle("  ${it.name} size=${it.length()} canRead=${it.canRead()}")
      }
    }

    val binResultsDir = binaryResultsDirectory.get().asFile
    logger.lifecycle("Binary results dir after tests: $binResultsDir")
    logger.lifecycle("  exists=${binResultsDir.exists()}")
    if (binResultsDir.exists()) {
      logger.lifecycle("Binary result files:")
      binResultsDir.listFiles()?.forEach { logger.lifecycle("  ${it.name} size=${it.length()}") }
    }

    // Check disk space again
    val root = if (resultsDir.exists()) resultsDir else project.projectDir
    logger.lifecycle("Disk space after tests:")
    logger.lifecycle(
        "  freeSpace=${root.freeSpace / (1024*1024)}MB, usableSpace=${root.usableSpace / (1024*1024)}MB")
  }
}

java { toolchain.languageVersion.set(JavaLanguageVersion.of(17)) }
