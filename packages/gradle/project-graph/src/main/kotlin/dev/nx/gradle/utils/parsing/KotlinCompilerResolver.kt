package dev.nx.gradle.utils.parsing

import java.net.URLClassLoader
import org.gradle.api.Project

object KotlinCompilerResolver {
  @Volatile private var cachedClassLoader: URLClassLoader? = null

  fun getCompilerClassLoader(project: Project): ClassLoader? {
    cachedClassLoader?.let {
      return it
    }

    val logger = project.logger
    val kotlinVersion = detectKotlinVersion(project)
    if (kotlinVersion == null) {
      logger.info("Could not detect Kotlin version from project ${project.name}")
      return null
    }

    logger.info("Detected Kotlin version $kotlinVersion for project ${project.name}")

    val jars =
        try {
          val detached =
              project.configurations.detachedConfiguration(
                  project.dependencies.create(
                      "org.jetbrains.kotlin:kotlin-compiler-embeddable:$kotlinVersion"))
          detached.exclude(
              mapOf("group" to "org.jetbrains.kotlin", "module" to "kotlin-gradle-plugin"))
          detached.exclude(
              mapOf("group" to "org.jetbrains.kotlin", "module" to "kotlin-gradle-plugin-api"))
          detached.exclude(
              mapOf("group" to "org.jetbrains.kotlin", "module" to "kotlin-gradle-plugin-idea"))
          detached.resolve()
        } catch (e: Exception) {
          logger.warn("Failed to resolve kotlin-compiler-embeddable:$kotlinVersion: ${e.message}")
          return null
        }

    if (jars.isEmpty()) {
      logger.info("No JARs resolved for kotlin-compiler-embeddable:$kotlinVersion")
      return null
    }

    val urls = jars.map { it.toURI().toURL() }.toTypedArray()
    val cl = URLClassLoader(urls, KotlinCompilerResolver::class.java.classLoader)
    cachedClassLoader = cl
    logger.info("Created URLClassLoader with ${jars.size} JARs for Kotlin compiler $kotlinVersion")
    return cl
  }

  private fun detectKotlinVersion(project: Project): String? {
    // Strategy 1: Read version from the Kotlin extension via reflection
    val kotlinExtension = project.extensions.findByName("kotlin")
    if (kotlinExtension != null) {
      try {
        val versionMethod = kotlinExtension.javaClass.getMethod("getCoreLibrariesVersion")
        val version = versionMethod.invoke(kotlinExtension) as? String
        if (version != null) return version
      } catch (_: Exception) {}
    }

    // Strategy 2: Walk all projects looking for the Kotlin extension
    val allProjects = project.rootProject.allprojects
    for (p in allProjects) {
      if (p == project) continue
      val ext = p.extensions.findByName("kotlin") ?: continue
      try {
        val versionMethod = ext.javaClass.getMethod("getCoreLibrariesVersion")
        val version = versionMethod.invoke(ext) as? String
        if (version != null) return version
      } catch (_: Exception) {}
    }

    // Strategy 3: Scan resolved configurations for kotlin-stdlib version
    val configurationsToCheck = listOf("compileClasspath", "runtimeClasspath")
    for (configName in configurationsToCheck) {
      val config = project.configurations.findByName(configName) ?: continue
      if (!config.isCanBeResolved) continue
      try {
        for (artifact in config.resolvedConfiguration.resolvedArtifacts) {
          val moduleId = artifact.moduleVersion.id
          if (moduleId.group == "org.jetbrains.kotlin" && moduleId.name == "kotlin-stdlib") {
            return moduleId.version
          }
        }
      } catch (_: Exception) {}
    }

    return null
  }
}
