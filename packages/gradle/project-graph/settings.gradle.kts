pluginManagement {
  repositories {
    mavenLocal()
    gradlePluginPortal()
  }
}

rootProject.name = "project-graph"

dependencyResolutionManagement {
  repositories {
    mavenLocal()
    mavenCentral()
    gradlePluginPortal()
  }

  versionCatalogs { create("libs") { from(files("../../../gradle/libs.versions.toml")) } }
}
