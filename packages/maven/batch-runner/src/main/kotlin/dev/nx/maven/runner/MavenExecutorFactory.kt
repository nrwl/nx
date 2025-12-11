package dev.nx.maven.runner

import org.slf4j.LoggerFactory
import java.io.File

/**
 * Factory for creating the appropriate MavenExecutor based on detected Maven version.
 *
 * Strategy:
 * - Maven 4.x: Use ResidentMavenExecutor (ResidentMavenInvoker + NxMaven caching)
 * - Maven 3.x: Use Maven3ResidentExecutor (MavenCli via reflection)
 *
 * Version detection is done by checking for Maven 4.x specific classes.
 */
object MavenExecutorFactory {
  private val log = LoggerFactory.getLogger(MavenExecutorFactory::class.java)

  /**
   * Create the appropriate MavenExecutor for the detected Maven version.
   *
   * @param mavenHome Maven installation directory
   * @return MavenExecutor optimized for the detected version
   */
  fun create(
    mavenHome: File?
  ): MavenExecutor {
    val isMaven4 = detectMaven4(mavenHome)

    return if (isMaven4) {
      log.debug("🚀 Detected Maven 4.x - using ResidentMavenExecutor")
      ResidentMavenExecutor(mavenHome)
    } else {
      log.debug("📦 Detected Maven 3.x - using Maven3ResidentExecutor")
      Maven3ResidentExecutor(mavenHome)
    }
  }

  /**
   * Detect Maven version by checking for Maven 4.x specific classes.
   *
   * Checks for ResidentMavenInvoker which only exists in Maven 4.x.
   */
  private fun detectMaven4(mavenHome: File?): Boolean {
    if (mavenHome == null) {
      log.warn("Maven home not available, defaulting to Maven 4.x detection via classpath")
      return try {
        Class.forName("org.apache.maven.cling.invoker.mvn.resident.ResidentMavenInvoker")
        true
      } catch (e: ClassNotFoundException) {
        false
      }
    }

    // Check for maven-cli JAR which contains ResidentMavenInvoker
    val libDir = File(mavenHome, "lib")
    if (!libDir.isDirectory) {
      log.warn("Maven lib directory not found: ${libDir.absolutePath}")
      return false
    }

    val hasMavenCli = libDir.listFiles()?.any { it.name.startsWith("maven-cli-4") } ?: false

    return if (hasMavenCli) {
      log.debug("✅ Found maven-cli-4.x JAR - Maven 4.x detected")
      true
    } else {
      log.debug("❌ maven-cli-4.x JAR not found - Maven 3.x detected")
      false
    }
  }
}
