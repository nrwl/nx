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

version = "0.1.8"

repositories { mavenCentral() }

dependencies {
  implementation(libs.gson)
  implementation(libs.javaparser.core)
  implementation(libs.kotlinx.coroutines.core)
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

tasks.test { useJUnitPlatform() }

java { toolchain.languageVersion.set(JavaLanguageVersion.of(17)) }
