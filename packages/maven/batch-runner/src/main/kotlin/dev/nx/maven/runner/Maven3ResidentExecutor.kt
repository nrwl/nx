package dev.nx.maven.runner

import dev.nx.maven.reflection.ReflectionHelper
import org.codehaus.plexus.classworlds.ClassWorld
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Maven 3.x Executor using MavenCli via reflection with resident caching.
 *
 * Current Strategy:
 * - Caches MavenCli instance (includes PlexusContainer + Maven components)
 * - Reuses same MavenCli across executions (~30-40% faster than subprocess)
 *
 * Future Enhancement:
 * Could add full NxMaven caching (like Maven 4.x) by:
 * 1. Converting CLI args to MavenExecutionRequest (requires MavenParser port)
 * 2. Extracting Maven instance from MavenCli after first execution
 * 3. Using PlexusContainerLookupAdapter to bridge to Lookup interface
 * 4. Creating NxMaven for cached project graph execution
 * This would provide ~75% performance improvement vs current ~30-40%.
 */
class Maven3ResidentExecutor(
  private val mavenInstallationDir: File? = null
) : MavenExecutor {
  private val log = LoggerFactory.getLogger(Maven3ResidentExecutor::class.java)

  private var mavenCli: Any? = null
  private lateinit var classWorld: ClassWorld
  private var initialized = false
  private var invocationCount = 0

  init {
    initializeMaven()
  }

  /**
   * Initialize Maven 3.x using MavenCli via reflection.
   */
  private fun initializeMaven() {
    log.debug("Initializing Maven 3.x with MavenCli...")

    // Set maven.home if available
    if (mavenInstallationDir != null) {
      System.setProperty("maven.home", mavenInstallationDir.absolutePath)
      log.debug("Set maven.home: ${mavenInstallationDir.absolutePath}")
    }

    // Create ClassWorld
    classWorld = ClassWorld("plexus.core", ClassLoader.getSystemClassLoader())

    // Add Maven's lib JARs to ClassRealm
    addMavenLibJarsToClassRealm()

    // Load and create MavenCli
    try {
      val mavenCliClass = ReflectionHelper.loadClass(classWorld, "org.apache.maven.cli.MavenCli")
      val constructor = mavenCliClass.getConstructor(ClassWorld::class.java)
      mavenCli = constructor.newInstance(classWorld)

      log.debug("MavenCli created successfully")
      initialized = true
    } catch (e: Exception) {
      log.error("Failed to create MavenCli: ${e.message}", e)
      throw RuntimeException("Could not initialize Maven 3.x", e)
    }
  }

  private fun addMavenLibJarsToClassRealm() {
    try {
      val coreRealm = classWorld.getClassRealm("plexus.core")
      val mavenLibDir = mavenInstallationDir?.let { File(it, "lib") }

      if (mavenLibDir?.isDirectory == true) {
        val jarFiles = mavenLibDir.listFiles { file -> file.name.endsWith(".jar") } ?: emptyArray()
        log.debug("Adding ${jarFiles.size} JARs from Maven lib to ClassRealm")

        jarFiles.forEach { jarFile ->
          try {
            coreRealm.addURL(jarFile.toURI().toURL())
          } catch (e: Exception) {
            log.warn("Failed to add JAR: ${jarFile.name}")
          }
        }
      }
    } catch (e: Exception) {
      log.error("Error adding Maven JARs: ${e.message}", e)
    }
  }

  override fun execute(
    goals: List<String>,
    arguments: List<String>,
    workingDir: File,
    outputStream: ByteArrayOutputStream
  ): Int {
    if (!initialized) {
      throw RuntimeException("Maven not initialized")
    }

    invocationCount++
    log.debug("execute() Invocation #$invocationCount with goals: $goals")

    // Set maven.multiModuleProjectDirectory - required by Maven 3.3+
    // This tells Maven where the root of the multi-module project is
    System.setProperty("maven.multiModuleProjectDirectory", workingDir.absolutePath)

    try {
      // Build Maven CLI arguments
      val allArguments = ArrayList<String>()
      allArguments.addAll(goals)
      allArguments.addAll(arguments)

      log.debug("Executing Maven 3.x with cached MavenCli: ${allArguments.joinToString(" ")}")
      println("[DEBUG] Maven3ResidentExecutor: args=${allArguments}, workingDir=$workingDir")

      // Call MavenCli.doMain() - reusing the same MavenCli instance across invocations
      // This keeps the PlexusContainer and Maven components in memory
      val doMainMethod = mavenCli!!.javaClass.getMethod(
        "doMain",
        Array<String>::class.java,
        String::class.java,
        java.io.PrintStream::class.java,
        java.io.PrintStream::class.java
      )

      val printStream = java.io.PrintStream(outputStream, true)

      val exitCode = doMainMethod.invoke(
        mavenCli,
        allArguments.toTypedArray(),
        workingDir.absolutePath,
        printStream,
        printStream
      ) as Int

      log.debug("Maven 3.x execution completed with exit code: $exitCode")
      println("[DEBUG] Maven3ResidentExecutor: exitCode=$exitCode, outputSize=${outputStream.size()}")
      return exitCode
    } catch (e: Exception) {
      log.error("Maven 3.x execution failed: ${e.message}", e)
      println("[ERROR] Maven3ResidentExecutor exception: ${e.message}")
      e.printStackTrace()
      return 1
    }
  }

  override fun shutdown() {
    log.debug("Maven3ResidentExecutor shutdown")
  }
}
