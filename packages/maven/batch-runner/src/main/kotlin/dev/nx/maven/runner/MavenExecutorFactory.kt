package dev.nx.maven.runner

import org.codehaus.plexus.classworlds.ClassWorld
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
 * IMPORTANT: For Maven 4.x, we must add Maven's lib JARs to the classpath BEFORE
 * loading ResidentMavenExecutor, because that class has direct imports of Maven 4 API
 * classes (InvokerException, ParserRequest, etc.) that must be resolvable at class load time.
 */
object MavenExecutorFactory {
  private val log = LoggerFactory.getLogger(MavenExecutorFactory::class.java)

  // ClassWorld used to load Maven classes - created once per JVM
  private var classWorld: ClassWorld? = null

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
   * Must set up ClassWorld with Maven lib JARs first, since Maven3CachingExecutor
   * has direct imports of Maven classes that need to be resolvable at class load time.
   */
  private fun createMaven3CachingExecutor(mavenHome: File?): MavenExecutor {
    return try {
      // Set up ClassWorld with Maven's lib JARs first
      val cw = getOrCreateClassWorld(mavenHome)
      val classRealm = cw.getClassRealm("plexus.core")

      // Set thread context classloader for class loading
      Thread.currentThread().contextClassLoader = classRealm

      // Load class via ClassRealm that has Maven JARs
      val clazz = classRealm.loadClass("dev.nx.maven.runner.Maven3CachingExecutor")
      val constructor = clazz.getConstructor(File::class.java)
      constructor.newInstance(mavenHome) as MavenExecutor
    } catch (e: Exception) {
      log.warn("Failed to create Maven3CachingExecutor: ${e.message}, falling back to Maven3ResidentExecutor")
      Maven3ResidentExecutor(mavenHome)
    }
  }

  /**
   * Create ResidentMavenExecutor after setting up the classpath with Maven 4 lib JARs.
   * Maven 4 API classes must be loadable before we can load ResidentMavenExecutor.
   */
  private fun createResidentMavenExecutor(mavenHome: File?): MavenExecutor {
    return try {
      // First, set up ClassWorld with Maven's lib JARs
      val cw = getOrCreateClassWorld(mavenHome)
      val classRealm = cw.getClassRealm("plexus.core")

      // Set the thread context classloader so class loading works correctly
      val originalTccl = Thread.currentThread().contextClassLoader
      Thread.currentThread().contextClassLoader = classRealm

      try {
        // Now load the class using the ClassRealm that has Maven JARs
        val clazz = classRealm.loadClass("dev.nx.maven.runner.ResidentMavenExecutor")
        val constructor = clazz.getConstructor(File::class.java)
        constructor.newInstance(mavenHome) as MavenExecutor
      } finally {
        // Keep TCCL set to classRealm - ResidentMavenExecutor needs it
        // Thread.currentThread().contextClassLoader = originalTccl
      }
    } catch (e: Exception) {
      log.error("Failed to create ResidentMavenExecutor: ${e.message}", e)
      throw RuntimeException("Could not create ResidentMavenExecutor. Is Maven 4.x installed?", e)
    }
  }

  /**
   * Get or create a ClassWorld with Maven's lib JARs added to the plexus.core realm.
   */
  @Synchronized
  private fun getOrCreateClassWorld(mavenHome: File?): ClassWorld {
    if (classWorld != null) {
      return classWorld!!
    }

    log.debug("Creating ClassWorld and adding Maven lib JARs...")
    val cw = ClassWorld("plexus.core", ClassLoader.getSystemClassLoader())

    // Add Maven's lib JARs to the ClassRealm
    val mavenLibDir = mavenHome?.let { File(it, "lib") }
    if (mavenLibDir?.isDirectory == true) {
      val coreRealm = cw.getClassRealm("plexus.core")
      val jarFiles = mavenLibDir.listFiles { file -> file.name.endsWith(".jar") } ?: emptyArray()
      log.debug("Adding ${jarFiles.size} JARs from ${mavenLibDir.absolutePath} to ClassRealm")

      jarFiles.forEach { jarFile ->
        try {
          coreRealm.addURL(jarFile.toURI().toURL())
        } catch (e: Exception) {
          log.warn("Failed to add JAR to ClassRealm: ${jarFile.name} - ${e.message}")
        }
      }
    } else {
      log.warn("Maven lib directory not found: ${mavenLibDir?.absolutePath}")
    }

    classWorld = cw
    return cw
  }

}
