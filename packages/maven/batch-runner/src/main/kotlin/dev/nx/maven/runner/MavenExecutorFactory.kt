package dev.nx.maven.runner

import org.slf4j.LoggerFactory
import java.io.File

/**
 * Factory for creating the appropriate MavenExecutor based on Maven version.
 *
 * Strategy:
 * - Maven 4.x: Use ResidentMavenExecutor (ResidentMavenInvoker + NxMaven caching)
 * - Maven 3.x: Use Maven3ResidentExecutor (MavenCli via reflection)
 *
 * Version detection is done by MavenHomeDiscovery and passed to this factory.
 *
 * IMPORTANT: ResidentMavenExecutor is loaded via reflection to avoid loading Maven 4.x
 * classes when running with Maven 3.x. The JVM would otherwise try to resolve Maven 4
 * imports (like InvokerException) at class load time, causing NoClassDefFoundError.
 */
object MavenExecutorFactory {
  private val log = LoggerFactory.getLogger(MavenExecutorFactory::class.java)

  /**
   * Create the appropriate MavenExecutor for the detected Maven version.
   *
   * @param mavenHome Maven installation directory
   * @param isMaven4 Whether Maven 4.x was detected (from MavenHomeDiscovery)
   * @return MavenExecutor optimized for the detected version
   */
  fun create(
    mavenHome: File?,
    isMaven4: Boolean
  ): MavenExecutor {
    return if (isMaven4) {
      log.debug("🚀 Using Maven 4.x - ResidentMavenExecutor")
      createResidentMavenExecutor(mavenHome)
    } else {
      log.debug("📦 Using Maven 3.x - Maven3CachingExecutor")
      createMaven3CachingExecutor(mavenHome)
    }
  }

  /**
   * Create Maven3CachingExecutor with fallback to Maven3ResidentExecutor.
   * Uses reflection to avoid loading classes that may not exist in older Maven versions.
   */
  private fun createMaven3CachingExecutor(mavenHome: File?): MavenExecutor {
    return try {
      val clazz = Class.forName("dev.nx.maven.runner.Maven3CachingExecutor")
      val constructor = clazz.getConstructor(File::class.java)
      constructor.newInstance(mavenHome) as MavenExecutor
    } catch (e: Exception) {
      log.warn("Failed to create Maven3CachingExecutor: ${e.message}, falling back to Maven3ResidentExecutor")
      Maven3ResidentExecutor(mavenHome)
    }
  }

  /**
   * Create ResidentMavenExecutor using reflection to avoid loading Maven 4.x classes
   * when running with Maven 3.x. This is necessary because the JVM resolves all class
   * references at class load time, not at instantiation time.
   */
  private fun createResidentMavenExecutor(mavenHome: File?): MavenExecutor {
    return try {
      val clazz = Class.forName("dev.nx.maven.runner.ResidentMavenExecutor")
      val constructor = clazz.getConstructor(File::class.java)
      constructor.newInstance(mavenHome) as MavenExecutor
    } catch (e: Exception) {
      log.error("Failed to create ResidentMavenExecutor: ${e.message}", e)
      throw RuntimeException("Could not create ResidentMavenExecutor. Is Maven 4.x installed?", e)
    }
  }

}
