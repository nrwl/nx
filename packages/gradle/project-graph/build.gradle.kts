plugins {
  `java-gradle-plugin`
  `maven-publish`
  signing
  id("com.ncorti.ktfmt.gradle") version "+"
  id("dev.nx.gradle.project-graph") version "0.1.0"
  id("org.jetbrains.kotlin.jvm") version "2.1.10"
  id("com.gradle.plugin-publish") version "1.2.1"
}

group = "dev.nx.gradle"

version = "0.1.1"

repositories { mavenCentral() }

dependencies {
  implementation("com.google.code.gson:gson:2.10.1")
  testImplementation(kotlin("test"))
  testImplementation("org.mockito:mockito-core:5.8.0")
  testImplementation("org.mockito.kotlin:mockito-kotlin:5.2.1")
  testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")
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
