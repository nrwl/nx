package dev.nx.maven.runner

import org.apache.maven.api.cli.InvokerException
import org.apache.maven.api.cli.ParserRequest
import org.apache.maven.api.services.Lookup
import org.apache.maven.api.services.MessageBuilderFactory
import org.apache.maven.cling.invoker.LookupContext
import org.apache.maven.cling.invoker.mvn.MavenContext
import org.apache.maven.cling.invoker.mvn.MavenParser
import org.apache.maven.cling.invoker.mvn.resident.ResidentMavenInvoker
import org.apache.maven.execution.MavenExecutionRequest
import org.apache.maven.jline.JLineMessageBuilderFactory
import org.codehaus.plexus.classworlds.ClassWorld
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.OutputStream
import java.io.PrintStream
import java.util.function.Consumer

/**
 * OutputStream that writes to both a capture buffer and streams to stdout in real-time.
 * (stdout is inherited by parent process, stderr is used for result JSON lines)
 */
class TeeOutputStream(
  private val capture: OutputStream,
  private val stream: OutputStream = System.out
) : OutputStream() {
  override fun write(b: Int) {
    capture.write(b)
    stream.write(b)
    stream.flush()
  }

  override fun write(b: ByteArray) {
    capture.write(b)
    stream.write(b)
    stream.flush()
  }

  override fun write(b: ByteArray, off: Int, len: Int) {
    capture.write(b, off, len)
    stream.write(b, off, len)
    stream.flush()
  }

  override fun flush() {
    capture.flush()
    stream.flush()
  }

  override fun close() {
    capture.close()
    // Don't close stream (System.out)
  }
}

/**
 * Custom ResidentMavenInvoker subclass that injects NxMaven to preserve session state across invocations.
 *
 * Key insight: By injecting the same NxMaven instance into every context,
 * NxMaven preserves its internal MavenSession across multiple goals.
 * This allows artifacts from jar:jar to be seen by install:install.
 */
class CachingResidentMavenInvoker(
  protoLookup: Lookup,
  contextConsumer: Consumer<LookupContext>?
) : ResidentMavenInvoker(protoLookup, contextConsumer) {
  private val log = LoggerFactory.getLogger(CachingResidentMavenInvoker::class.java)

  // Single NxMaven instance reused across all invocations - preserves session state
  private var nxMaven: NxMaven? = null

  override fun lookup(context: MavenContext) {
    super.lookup(context)
    context.maven = createNxMavenIfNeeded(context)
  }


  override fun doExecute(context: MavenContext, request: MavenExecutionRequest): Int {
    (context.maven as NxMaven).setupGraphCache(request)

    return super.doExecute(context, request)
  }

  /**
   * Create NxMaven after the first successful execution when the Maven context is fully initialized.
   * This is called from ResidentMavenExecutor after exitCode == 0 on first invocation.
   */
  fun createNxMavenIfNeeded(context: MavenContext): NxMaven {
    if (nxMaven != null) {
      log.debug("NxMaven already created")
      return nxMaven!!
    }

    log.debug("🚀 Creating NxMaven...")

    nxMaven = NxMavenFactory(context.lookup).create()

    log.debug("✅ NxMaven created and cached - will be reused for all later invocations")

    return nxMaven!!
  }

  /**
   * Get the NxMaven instance if it has been created.
   * Returns null if NxMaven has not been initialized yet.
   */
  fun getNxMaven(): NxMaven? = nxMaven
}

/**
 * Maven Executor using ResidentMavenInvoker for efficient batch execution.
 *
 * This approach:
 * 1. Uses Maven 4.x's official ResidentMavenInvoker from maven-cli
 * 2. Keeps Maven service resident in memory across executions
 * 3. Caches entire Maven context (DI container, project models, service lookup)
 * 4. Caches RepositoryCache to avoid re-resolving dependencies
 * 5. Eliminates project rescanning on subsequent invocations
 *
 * Performance: ~75% faster on cached tasks (saves POM parsing + dependency resolution)
 *
 * Benefits over ProperMavenSessionExecutor:
 * - Uses official Maven 4.x APIs (no reflection)
 * - Cleaner, more maintainable code
 * - Built-in context caching and cleanup
 * - Proper support for extensions and plugins
 * - Persistent repository cache for artifact resolution
 */
class ResidentMavenExecutor(
  private val workspaceRoot: File,
  private val mavenInstallationDir: File? = null
) : MavenExecutor {
  private val log = LoggerFactory.getLogger(ResidentMavenExecutor::class.java)

  // Resident invoker and parser - kept in memory for reuse
  private lateinit var invoker: ResidentMavenInvoker
  private lateinit var parser: MavenParser
  private lateinit var classWorld: ClassWorld
  private var initialized = false
  private var invocationCount = 0

  // Cached Maven home - found once during initialization and reused
  private var cachedMavenHome: File? = null

  init {
    initializeMaven()
  }


  /**
   * Discover Maven home directory using the standard priority order.
   * Uses MavenHomeDiscovery utility for the actual discovery logic.
   */
  private fun findMavenHome(): File? {
    val discovery = MavenHomeDiscovery(workspaceRoot)
    return discovery.discoverMavenHome()
  }

  /**
   * Initialize Maven using ResidentMavenInvoker.
   * Creates a resident Maven instance that persists across invocations.
   */
  private fun initializeMaven() {
    // Configure Maven's logging BEFORE any Maven classes are loaded
    // Maven 4 uses "maven.logger.*" properties
    System.setProperty("maven.logger.showThreadName", "false")
    System.setProperty("maven.logger.showDateTime", "false")
    System.setProperty("maven.logger.showLogName", "false")
    System.setProperty("maven.logger.levelInBrackets", "true")
    System.setProperty("style.color", "always")
    System.setProperty("jansi.force", "true")

    log.debug("Initializing Maven with ResidentMavenInvoker...")

    // Find and cache Maven home first
    cachedMavenHome = mavenInstallationDir ?: findMavenHome()
    if (cachedMavenHome != null) {
      log.debug("Maven home: ${cachedMavenHome?.absolutePath}")
      // Set maven.home system property for Maven to detect (required for local/embedded mode)
      System.setProperty("maven.home", cachedMavenHome!!.absolutePath)
      log.debug("Set maven.home system property to: ${cachedMavenHome?.absolutePath}")
    } else {
      log.warn("Could not find Maven home")
    }

    // Create ClassWorld for loading Maven classes
    this.classWorld = ClassWorld("plexus.core", ClassLoader.getSystemClassLoader())

    // Add Maven's lib JARs to the plexus.core ClassRealm to ensure correct versions are loaded
    // This prevents old embedded classes in sisu.plexus from taking precedence
    addMavenLibJarsToClassRealm()

    // Create a basic Lookup for the invoker
    // ResidentMavenInvoker expects a Lookup that it will use to populate the MavenContext
    val lookup = createBasicLookup(classWorld)

    log.debug("✅ ProtoLookup configured with ClassWorld")

    // Create the resident invoker - this will cache contexts and repository cache across invocations
    invoker = CachingResidentMavenInvoker(
      lookup, null
    )

    // Create the Maven parser for parsing command-line arguments
    parser = MavenParser()

    // Set TCCL to plexus.core ClassRealm globally for the entire JVM
    // This ensures all threads (including thread pool threads) can load Maven/Plexus classes
    val plexusCoreRealm = classWorld.getClassRealm("plexus.core")
    Thread.currentThread().contextClassLoader = plexusCoreRealm

    initialized = true
  }


  /**
   * Add Maven's lib directory JARs to the plexus.core ClassRealm.
   * This ensures Maven classes from the installation are available.
   * (plexus-container-default is shaded into the batch-runner JAR since Maven 4.x doesn't ship it)
   */
  private fun addMavenLibJarsToClassRealm() {
    try {
      val coreRealm = classWorld.getClassRealm("plexus.core")
      val mavenHome = cachedMavenHome
      val mavenLibDir = mavenHome?.let { File(it, "lib") }

      if (mavenLibDir?.isDirectory == true) {
        val jarFiles = mavenLibDir.listFiles { file -> file.name.endsWith(".jar") } ?: emptyArray()
        log.debug("Found ${jarFiles.size} JAR files in Maven lib directory")

        jarFiles.forEach { jarFile ->
          try {
            // Proper way: Convert File to file:// URL
            val jarUrl = jarFile.toURI().toURL()
            coreRealm.addURL(jarUrl)
          } catch (e: Exception) {
            log.warn("Failed to add JAR to ClassRealm: ${jarFile.name} - ${e.message}")
          }
        }

        // Force load key Maven classes to trigger package registration in ClassRealm
        // (definedPackages only shows packages with loaded classes)
        val keyMavenClasses = listOf(
          "org.apache.maven.Maven",
          "org.apache.maven.cli.MavenCli",
          "org.apache.maven.project.MavenProject",
          "org.apache.maven.execution.MavenSession"
        )

        for (className in keyMavenClasses) {
          try {
            coreRealm.loadClass(className)
          } catch (e: Exception) {
            log.warn("Could not load $className: ${e.message}")
          }
        }
      } else {
        log.warn("Maven lib directory not found or not a directory: ${mavenLibDir?.absolutePath}")
      }
    } catch (e: Exception) {
      log.error("Error adding Maven JARs to ClassRealm: ${e.message}", e)
    }
  }

  /**
   * Create a Lookup for the invoker with ClassWorld mapping.
   * This follows the same pattern as Maven's own test code.
   */
  private fun createBasicLookup(classWorld: ClassWorld): Lookup {
    // Use reflection to load ProtoLookup dynamically (available from shaded maven-cli)
    return try {
      val protoLookupClass = Class.forName("org.apache.maven.cling.invoker.ProtoLookup")
      val builderMethod = protoLookupClass.getMethod("builder")
      val builder = builderMethod.invoke(null)

      val addMappingMethod = builder.javaClass.getMethod("addMapping", Class::class.java, Any::class.java)
      addMappingMethod.invoke(builder, ClassWorld::class.java, classWorld)

      val buildMethod = builder.javaClass.getMethod("build")
      buildMethod.invoke(builder) as Lookup
    } catch (e: Exception) {
      log.error("Failed to create ProtoLookup with ClassWorld mapping: ${e.message}", e)
      throw RuntimeException("Could not create ProtoLookup: ${e.message}", e)
    }
  }

  override fun execute(
    goals: List<String>,
    arguments: List<String>,
    workingDir: File,
    outputStream: ByteArrayOutputStream
  ): Int {
    if (!initialized) {
      throw RuntimeException("Maven not properly initialized")
    }

    invocationCount++
    log.debug("execute() Invocation #$invocationCount with goals: $goals")
    val startTime = System.currentTimeMillis()

    // Stream output to stderr in real-time while also capturing for results
    val streamingOutput = TeeOutputStream(outputStream)

    return try {
      // Use invoker.invoke() to execute goals
      // Session reuse is handled by NxMaven (via NxMavenRegistrationExtension)

      // Build Maven CLI arguments: combine goals and other arguments
      val allArguments = ArrayList<String>()
      allArguments.addAll(arguments)
      allArguments.addAll(goals)

      log.debug("Executing Maven with goals: $goals, arguments: $arguments from directory: $workingDir")

      // Create a message builder factory for formatting output
      val messageBuilderFactory: MessageBuilderFactory = JLineMessageBuilderFactory()

      // Use cached Maven home (found during initialization)
      val mavenHome = cachedMavenHome

      // Create ParserRequest from our arguments
      // Following the official Maven test pattern (MavenInvokerTestSupport.java)
      val parserRequestBuilder = ParserRequest.mvn(allArguments.toList(), messageBuilderFactory)
        .cwd(workingDir.toPath())
        .userHome(File(System.getProperty("user.home")).toPath())
        .stdOut(streamingOutput)
        .stdErr(streamingOutput)
        .embedded(true) // Running embedded, not as CLI

      // Set Maven home if available
      if (mavenHome != null) {
        parserRequestBuilder.mavenHome(mavenHome.toPath())
      }

      val parserRequest = parserRequestBuilder.build()

      // Parse the request to get InvokerRequest
      val invokerRequest = try {
        val parseTime = System.currentTimeMillis()
        val result = parser.parseInvocation(parserRequest)
        val parseDuration = System.currentTimeMillis() - parseTime
        if (parseDuration > 10) {
          log.debug("parser.parseInvocation() took ${parseDuration}ms")
        }
        result
      } catch (e: Exception) {
        log.error("Failed to parse Maven invocation: ${e.message}", e)
        outputStream.write("ERROR: Failed to parse Maven command: ${e.message}\n".toByteArray())
        if (e.cause != null) {
          outputStream.write("Cause: ${e.cause?.message}\n".toByteArray())
        }
        e.printStackTrace(System.err)
        return 1
      }

      // Check if parsing failed and extract error messages from logger
      if (invokerRequest.parsingFailed()) {
        log.error("Maven argument parsing failed")
        outputStream.write("ERROR: Maven argument parsing failed\n".toByteArray())

        // Try to get accumulated error messages from the logger
        val logger = parserRequest.logger()
        try {
          val accumulatingLoggerClass = Class.forName("org.apache.maven.api.cli.logging.AccumulatingLogger")
          if (accumulatingLoggerClass.isInstance(logger)) {
            val drainMethod = accumulatingLoggerClass.getMethod("drain")
            val entries = drainMethod.invoke(logger) as List<*>

            if (entries.isNotEmpty()) {
              outputStream.write("\nParsing Error Details:\n".toByteArray())
              for (entry in entries) {
                val levelField = entry?.javaClass?.getDeclaredField("level")
                val messageField = entry?.javaClass?.getDeclaredField("message")
                val errorField = entry?.javaClass?.getDeclaredField("error")

                levelField?.isAccessible = true
                messageField?.isAccessible = true
                errorField?.isAccessible = true

                val level = levelField?.get(entry)?.toString() ?: "UNKNOWN"
                val message = messageField?.get(entry)?.toString() ?: ""
                val error = errorField?.get(entry)

                outputStream.write("[$level] $message\n".toByteArray())
                if (error != null && error != "null") {
                  outputStream.write("  Error: $error\n".toByteArray())
                }
              }
            }
          }
        } catch (e: Exception) {
          log.debug("Could not extract error details from logger: ${e.message}")
        }

        return 1
      }

      // ResidentMavenInvoker may try to read from stdin - provide empty input to prevent hanging
      val originalIn = System.`in`
      val stdinSetTime = System.currentTimeMillis()
      System.setIn(java.io.ByteArrayInputStream(ByteArray(0)))
      val stdinSetDuration = System.currentTimeMillis() - stdinSetTime
      if (stdinSetDuration > 10) {
        log.debug("System.setIn() took ${stdinSetDuration}ms")
      }

      val exitCode = try {
        val invokeTimeNano = System.nanoTime()

        // Invoke Maven using the resident invoker
        // This will reuse the cached Maven context if available
        val result = invoker.invoke(invokerRequest)
        val invokeActualTimeNano = System.nanoTime() - invokeTimeNano
        val invokeActualTimeMs = invokeActualTimeNano / 1_000_000
        log.debug("invoker.invoke() completed in ${invokeActualTimeMs}ms, returned: $result")
        result
      } catch (e: NoSuchMethodError) {
        // Maven version mismatch - plexus-container method not available
        log.error("❌ Maven version incompatibility: ${e.message}", e)
        log.info("This typically means the detected Maven version doesn't have plexus-container.setClassPathScanning()")
        log.info("Available Maven 4 versions on this system:")
        val userHome = System.getProperty("user.home")
        val wrapperDir = File(userHome, ".m2/wrapper/dists")
        if (wrapperDir.exists()) {
          wrapperDir.listFiles()?.filter { it.isDirectory && it.name.startsWith("apache-maven-4") }
            ?.forEach { log.info("  - ${it.name}") }
        }
        outputStream.write("\nEXCEPTION: Maven version incompatibility - ${e.message}\n".toByteArray())
        e.printStackTrace(PrintStream(outputStream, true))
        1  // Return failure exit code
      } catch (e: Throwable) {
        log.error("❌ EXCEPTION during invoker.invoke(): ${e.javaClass.simpleName}: ${e.message}, ${e.cause}", e)
//        outputStream.write("\nEXCEPTION: ${e.message}\n".toByteArray())
        e.printStackTrace(PrintStream(outputStream, true))
        1  // Return failure exit code
      } finally {
        val stdinRestoreTime = System.currentTimeMillis()
        System.setIn(originalIn)
        val stdinRestoreDuration = System.currentTimeMillis() - stdinRestoreTime
        if (stdinRestoreDuration > 10) {
          log.debug("System.setIn(original) took ${stdinRestoreDuration}ms")
        }
      }

      val duration = System.currentTimeMillis() - startTime
      // Output was already streamed in real-time via TeeOutputStream

      if (exitCode == 0) {
        log.debug("Maven completed in ${duration}ms")
      } else {
        log.debug("Maven failed with exit code $exitCode in ${duration}ms")
      }
      exitCode
    } catch (e: InvokerException) {
      log.error("Maven invocation failed: ${e.message}", e)
      outputStream.write("ERROR: Maven execution failed - ${e.message}\n".toByteArray())
      e.printStackTrace(System.err)
      1
    } catch (e: Exception) {
      log.error("Unexpected error executing Maven: ${e.message}", e)
      outputStream.write("ERROR: Unexpected error - ${e.message}\n".toByteArray())
      e.printStackTrace(System.err)
      1
    }
  }

  /**
   * Get the NxMaven instance if it has been created.
   * Returns null if the executor is not initialized or NxMaven is not available.
   */
  fun getNxMaven(): NxMaven? {
    return if (initialized && this::invoker.isInitialized) {
      (invoker as? CachingResidentMavenInvoker)?.getNxMaven()
    } else {
      null
    }
  }

  override fun shutdown() {
    if (initialized) {
      try {
        // Close the resident invoker
        try {
          invoker.close()
          log.info("ResidentMavenInvoker closed")
        } catch (e: Exception) {
          log.error("Error closing invoker: ${e.message}")
        }

        // ClassWorld will be garbage collected when there are no more references
        // (dispose() method not available, but clearing references helps GC)

        log.info("ResidentMavenExecutor shutdown complete")
      } catch (e: Exception) {
        log.error("Error during shutdown: ${e.message}", e)
      }
    }
  }
}
