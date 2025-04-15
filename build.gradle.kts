plugins {
    id("dev.nx.gradle.project-graph") version("0.0.2")
    id("com.ncorti.ktfmt.gradle") version("+")
}

group = "dev.nx"

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
