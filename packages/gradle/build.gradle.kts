group = "io.nx"

plugins {
    id("io.nx.gradle.native") version("+")
}

allprojects {
  apply {
      plugin("project-report")
  }
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