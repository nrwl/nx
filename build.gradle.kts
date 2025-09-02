plugins {
    id("dev.nx.gradle.project-graph") version("0.1.5")
    id("com.ncorti.ktfmt.gradle") version("+")
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
