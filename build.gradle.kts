plugins {
    id("dev.nx.gradle.project-graph") version("0.1.0")
    id("com.ncorti.ktfmt.gradle") version("+")
}

group = "dev.nx"
allprojects {
    apply {
        plugin("dev.nx.gradle.project-graph")
    }
  }