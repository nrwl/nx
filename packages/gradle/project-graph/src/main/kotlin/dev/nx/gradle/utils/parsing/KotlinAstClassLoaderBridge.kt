package dev.nx.gradle.utils.parsing

import java.io.File
import java.net.URL
import java.net.URLClassLoader
import java.util.WeakHashMap
import org.gradle.api.Project
import org.gradle.api.logging.Logger

/** Cache combined classloaders per project to avoid repeated dependency resolution. */
private val classLoaderCache = WeakHashMap<Project, ClassLoader?>()

/**
 * Parse a Kotlin file using the AST parser via a classloader that has kotlin-compiler-embeddable
 * available. This bridges the gap between the plugin's compileOnly dependency on the compiler and
 * the need to use it at runtime.
 *
 * The approach:
 * 1. Detect the Kotlin version from the user's project (via KGP extension or kotlin-stdlib)
 * 2. Resolve kotlin-compiler-embeddable via a detached Gradle configuration
 * 3. Create a URLClassLoader combining compiler JARs + Nx plugin JARs, with Gradle API as parent
 * 4. Load and invoke the AST parser through reflection
 */
fun parseKotlinFileWithReflection(
    file: File,
    project: Project,
    logger: Logger?
): MutableMap<String, String>? {
  val classLoader = getOrCreateClassLoader(project, logger) ?: return null

  return try {
    val parserClass =
        classLoader.loadClass("dev.nx.gradle.utils.parsing.KotlinAstTestParserKt")
    val method =
        parserClass.getMethod("parseKotlinFileViaAst", File::class.java, Logger::class.java)

    @Suppress("UNCHECKED_CAST") val result = method.invoke(null, file, logger) as? Map<String, String>
    result?.toMutableMap()
  } catch (e: Exception) {
    logger?.info(
        "Kotlin AST reflection invocation failed for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
    null
  } catch (e: Error) {
    logger?.info(
        "Kotlin AST reflection invocation error for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
    null
  }
}

private fun getOrCreateClassLoader(project: Project, logger: Logger?): ClassLoader? {
  return classLoaderCache.getOrPut(project) { createKotlinAstClassLoader(project, logger) }
}

private fun createKotlinAstClassLoader(project: Project, logger: Logger?): ClassLoader? {
  val kotlinVersion = detectKotlinVersion(project, logger)
  if (kotlinVersion == null) {
    logger?.info(
        "Cannot detect Kotlin version for project ${project.name}, skipping AST parsing")
    return null
  }

  logger?.info("Detected Kotlin version $kotlinVersion for AST parsing in ${project.name}")

  return try {
    val compilerDep =
        project.dependencies.create(
            "org.jetbrains.kotlin:kotlin-compiler-embeddable:$kotlinVersion")
    val detachedConfig = project.configurations.detachedConfiguration(compilerDep)
    detachedConfig.isTransitive = true

    val compilerJars = detachedConfig.resolve()
    val compilerUrls = compilerJars.map { it.toURI().toURL() }

    val nxPluginUrl = getNxPluginJarUrl()
    val allUrls =
        if (nxPluginUrl != null) {
          (compilerUrls + nxPluginUrl).toTypedArray()
        } else {
          logger?.warn("Cannot locate Nx plugin JAR, AST parsing may fail")
          compilerUrls.toTypedArray()
        }

    // Use the Gradle API classloader as parent so Gradle types (Logger, etc.) are resolvable.
    // The URLClassLoader's own URLs provide the compiler classes and Nx plugin classes.
    URLClassLoader(allUrls, Project::class.java.classLoader)
  } catch (e: Exception) {
    logger?.warn("Failed to create Kotlin AST classloader: ${e.javaClass.simpleName} - ${e.message}")
    null
  }
}

/**
 * Detect the Kotlin version used by the project.
 *
 * Strategy 1: Read from KGP's "kotlin" extension via reflection (avoids compile-time KGP
 * dependency). Strategy 2: Find kotlin-stdlib version from project configurations.
 */
internal fun detectKotlinVersion(project: Project, logger: Logger? = null): String? {
  // Strategy 1: KGP extension
  try {
    val ext = project.extensions.findByName("kotlin")
    if (ext != null) {
      val method = ext.javaClass.getMethod("getCoreLibrariesVersion")
      val version = method.invoke(ext) as? String
      if (version != null) {
        logger?.info("Detected Kotlin version from KGP extension: $version")
        return version
      }
    }
  } catch (e: Exception) {
    logger?.debug("Could not read Kotlin version from KGP extension: ${e.message}")
  }

  // Strategy 2: Find kotlin-stdlib in resolved configurations
  return findKotlinStdlibVersion(project, logger)
}

private fun findKotlinStdlibVersion(project: Project, logger: Logger?): String? {
  val configNames = listOf("compileClasspath", "testCompileClasspath")
  for (configName in configNames) {
    val config = project.configurations.findByName(configName) ?: continue
    if (!config.isCanBeResolved) continue
    try {
      val artifact =
          config.resolvedConfiguration.resolvedArtifacts.firstOrNull {
            it.moduleVersion.id.module.toString() == "org.jetbrains.kotlin:kotlin-stdlib"
          }
      if (artifact != null) {
        val version = artifact.moduleVersion.id.version
        logger?.info("Detected Kotlin version from $configName: $version")
        return version
      }
    } catch (e: Exception) {
      logger?.debug("Could not resolve $configName for Kotlin version detection: ${e.message}")
    }
  }
  return null
}

/** Get the URL of the JAR containing the Nx plugin's parsing classes. */
private fun getNxPluginJarUrl(): URL? {
  return try {
    // Use a known class from the Nx plugin JAR to find its location
    Class.forName("dev.nx.gradle.utils.parsing.RegexTestParserKt")
        .protectionDomain
        ?.codeSource
        ?.location
  } catch (e: Exception) {
    null
  }
}
