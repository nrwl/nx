plugins {
    id("dev.nx.gradle.project-graph") version("+")
    id("com.ncorti.ktfmt.gradle") version("+")
}

group = "dev.nx"

allprojects {
  apply {
      plugin("project-report")
      plugin("dev.nx.gradle.project-graph")
      plugin("com.ncorti.ktfmt.gradle")
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
