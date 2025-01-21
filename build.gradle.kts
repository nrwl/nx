group = "dev.nx"

plugins {
    // id("dev.nx.gradle.native") version("+")
}

allprojects {
  apply {
      plugin("project-report")
  }
}

repositories {
    // Use Maven Central for resolving dependencies.
    mavenCentral()
}

tasks.register("projectReportAll") {
    // All project reports of subprojects
    allprojects.forEach {
        dependsOn(it.tasks.get("projectReport"))
    }

    // All projectReportAll of included builds
    gradle.includedBuilds.forEach {
        dependsOn(it.task(":projectReportAll"))
    }
}