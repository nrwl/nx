plugins {
  `java-gradle-plugin`
  `maven-publish`
  id("com.ncorti.ktfmt.gradle") version "+"
  id("org.jetbrains.kotlin.jvm") version "2.1.10"
}

group = "dev.nx"

version = "0.0.1-beta.2"

repositories { mavenCentral() }

dependencies {
  implementation("com.google.code.gson:gson:2.10.1")
  testImplementation(kotlin("test"))
}

java {
  withSourcesJar()
  withJavadocJar()
}

gradlePlugin {
  plugins {
    create("nxProjectGraphPlugin") {
      id = "dev.nx.gradle"
      implementationClass = "dev.nx.gradle.NxProjectGraphReportPlugin"
      displayName = "The Nx Plugin for Gradle to generate Nx project graph"
      description = "Generates a JSON file with nodes, dependencies, and external nodes for Nx"
    }
  }
}

publishing {
  publications {
    create<MavenPublication>("mavenJava") {
      from(components["java"])
      groupId = "dev.nx"
      artifactId = "gradle"
      version = "0.0.1-beta.2"

      pom {
        name.set("Nx Gradle Project Graph Plugin")
        description.set(
            "A plugin to generate a JSON file with nodes, dependencies, and external nodes for Nx")
        url.set("https://github.com/nrwl/nx")

        licenses {
          license {
            name.set("The Apache License, Version 2.0")
            url.set("https://www.apache.org/licenses/LICENSE-2.0.txt")
          }
        }

        developers {
          developer {
            id.set("nx")
            name.set("Nx Java Services")
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
  }

  repositories {
    maven {
      name = "localStaging"
      url = uri(layout.buildDirectory.dir("staging-repo"))
    }
  }
}

tasks.test { useJUnitPlatform() }
