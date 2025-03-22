plugins {
    // id("dev.nx.gradle.native") version("0.0.1-alpha.4")
    id("com.ncorti.ktfmt.gradle") version("+")
}

group = "dev.nx.gradle"

allprojects {
  apply {
      plugin("project-report")
      // plugin("dev.nx.gradle")
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
