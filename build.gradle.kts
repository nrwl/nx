plugins {
    alias(libs.plugins.nx.project.graph)
    alias(libs.plugins.ktfmt)
}

group = "dev.nx"

tasks {
    register("clean") {
        description = "Cleans all included builds"
        dependsOn(gradle.includedBuilds.map { it.task(":clean") })
        doLast {
            println("Cleaned ${gradle.includedBuilds.size} included builds")
        }
    }

    register("testClasses") {
        description = "Compiles test classes for all included builds"
        dependsOn(gradle.includedBuilds.map { it.task(":testClasses") })
        doLast {
            println("Compiled test classes for ${gradle.includedBuilds.size} included builds")
        }
    }
}
