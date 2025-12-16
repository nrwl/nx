package dev.nx.maven.runner

import org.codehaus.plexus.classworlds.ClassWorld
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.PrintStream
import java.lang.reflect.Method

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
 * IMPORTANT: This class uses reflection for ALL Maven 4 API to avoid class loading issues.
 * Maven 4 classes are loaded dynamically after Maven libs are on the classpath.
 */
class ResidentMavenExecutor(
  private val mavenInstallationDir: File? = null
) : MavenExecutor {
  private val log = LoggerFactory.getLogger(ResidentMavenExecutor::class.java)

  // Resident invoker and parser - kept in memory for reuse (loaded via reflection)
  private var invoker: Any? = null
  private var parser: Any? = null
  private lateinit var classWorld: ClassWorld
  private var initialized = false
  private var invocationCount = 0

  // Cached Maven home - found once during initialization and reused
  private var cachedMavenHome: File? = null

  // Cached reflection methods
  private var parseInvocationMethod: Method? = null
  private var invokeMethod: Method? = null
  private var parsingFailedMethod: Method? = null
  private var closeMethod: Method? = null

  init {
    initializeMaven()
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

    // Use the Maven home passed from caller (discovered by MavenInvokerRunner)
    cachedMavenHome = mavenInstallationDir
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

    // Create a basic Lookup for the invoker using reflection
    val lookup = createBasicLookup(classWorld)

    log.debug("ProtoLookup configured with ClassWorld")

    // Get the ClassRealm for loading Maven 4 classes
    val classRealm = classWorld.getClassRealm("plexus.core")

    // Set TCCL to plexus.core ClassRealm globally for the entire JVM
    // This ensures all threads (including thread pool threads) can load Maven/Plexus classes
    Thread.currentThread().contextClassLoader = classRealm

    // Create the resident invoker using reflection - this will cache contexts and repository cache across invocations
    val cachingInvokerClass = classRealm.loadClass("dev.nx.maven.runner.CachingResidentMavenInvoker")
    val lookupClass = classRealm.loadClass("org.apache.maven.api.services.Lookup")
    val consumerClass = Class.forName("java.util.function.Consumer")
    val invokerConstructor = cachingInvokerClass.getConstructor(lookupClass, consumerClass)
    invoker = invokerConstructor.newInstance(lookup, null)

    // Get the invoke method
    val invokerRequestClass = classRealm.loadClass("org.apache.maven.api.cli.InvokerRequest")
    invokeMethod = invoker!!.javaClass.getMethod("invoke", invokerRequestClass)
    closeMethod = invoker!!.javaClass.getMethod("close")

    // Create the Maven parser for parsing command-line arguments using reflection
    val parserClass = classRealm.loadClass("org.apache.maven.cling.invoker.mvn.MavenParser")
    parser = parserClass.getDeclaredConstructor().newInstance()

    // Get the parseInvocation method
    val parserRequestClass = classRealm.loadClass("org.apache.maven.api.cli.ParserRequest")
    parseInvocationMethod = parser!!.javaClass.getMethod("parseInvocation", parserRequestClass)

    // Get parsingFailed method from InvokerRequest
    parsingFailedMethod = invokerRequestClass.getMethod("parsingFailed")

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
            val jarUrl = jarFile.toURI().toURL()
            coreRealm.addURL(jarUrl)
          } catch (e: Exception) {
            log.warn("Failed to add JAR to ClassRealm: ${jarFile.name} - ${e.message}")
          }
        }

        // Force load key Maven classes to trigger package registration in ClassRealm
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
   * Create a Lookup for the invoker with ClassWorld mapping using reflection.
   * This follows the same pattern as Maven's own test code.
   */
  private fun createBasicLookup(classWorld: ClassWorld): Any {
    return try {
      val classRealm = classWorld.getClassRealm("plexus.core")
      val protoLookupClass = classRealm.loadClass("org.apache.maven.cling.invoker.ProtoLookup")
      val builderMethod = protoLookupClass.getMethod("builder")
      val builder = builderMethod.invoke(null)

      val addMappingMethod = builder.javaClass.getMethod("addMapping", Class::class.java, Any::class.java)
      addMappingMethod.invoke(builder, ClassWorld::class.java, classWorld)

      val buildMethod = builder.javaClass.getMethod("build")
      buildMethod.invoke(builder)
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
      // Build Maven CLI arguments: combine goals and other arguments
      // Maven 4 parser requires goals BEFORE options
      val allArguments = ArrayList<String>()
      allArguments.addAll(goals)
      allArguments.addAll(arguments)
      // Enable raw-streams so System.out/err are not redirected to logging
      // This ensures plugin output (like test failures) is captured in our output stream
      if (!allArguments.contains("--raw-streams")) {
        allArguments.add("--raw-streams")
      }

      log.debug("Executing Maven with goals: $goals, arguments: $arguments from directory: $workingDir")

      // Use cached Maven home (found during initialization)
      val mavenHome = cachedMavenHome

      // Create ParserRequest using reflection
      val classRealm = classWorld.getClassRealm("plexus.core")
      val messageBuilderFactoryClass = classRealm.loadClass("org.apache.maven.api.services.MessageBuilderFactory")
      val jlineMessageBuilderFactoryClass = classRealm.loadClass("org.apache.maven.jline.JLineMessageBuilderFactory")
      val messageBuilderFactory = jlineMessageBuilderFactoryClass.getDeclaredConstructor().newInstance()

      val parserRequestClass = classRealm.loadClass("org.apache.maven.api.cli.ParserRequest")
      val mvnMethod = parserRequestClass.getMethod("mvn", List::class.java, messageBuilderFactoryClass)
      val parserRequestBuilder = mvnMethod.invoke(null, allArguments.toList(), messageBuilderFactory)

      // Set builder properties
      val cwdMethod = parserRequestBuilder.javaClass.getMethod("cwd", java.nio.file.Path::class.java)
      cwdMethod.invoke(parserRequestBuilder, workingDir.toPath())

      val userHomeMethod = parserRequestBuilder.javaClass.getMethod("userHome", java.nio.file.Path::class.java)
      userHomeMethod.invoke(parserRequestBuilder, File(System.getProperty("user.home")).toPath())

      val stdOutMethod = parserRequestBuilder.javaClass.getMethod("stdOut", java.io.OutputStream::class.java)
      stdOutMethod.invoke(parserRequestBuilder, streamingOutput)

      val stdErrMethod = parserRequestBuilder.javaClass.getMethod("stdErr", java.io.OutputStream::class.java)
      stdErrMethod.invoke(parserRequestBuilder, streamingOutput)

      val embeddedMethod = parserRequestBuilder.javaClass.getMethod("embedded", Boolean::class.java)
      embeddedMethod.invoke(parserRequestBuilder, true)

      // Set Maven home if available
      if (mavenHome != null) {
        val mavenHomeMethod = parserRequestBuilder.javaClass.getMethod("mavenHome", java.nio.file.Path::class.java)
        mavenHomeMethod.invoke(parserRequestBuilder, mavenHome.toPath())
      }

      val buildMethod = parserRequestBuilder.javaClass.getMethod("build")
      val parserRequest = buildMethod.invoke(parserRequestBuilder)

      // Parse the request to get InvokerRequest
      val parseTime = System.currentTimeMillis()
      val invokerRequest = parseInvocationMethod!!.invoke(parser, parserRequest)
      val parseDuration = System.currentTimeMillis() - parseTime
      log.debug("parser.parseInvocation() took ${parseDuration}ms")

      // Check if parsing failed
      val parsingFailed = parsingFailedMethod!!.invoke(invokerRequest) as Boolean
      if (parsingFailed) {
        val errorMessage = "Maven argument parsing failed for: ${allArguments.joinToString(" ")}"
        log.error(errorMessage)
        System.err.println("[ERROR] $errorMessage")
        outputStream.write("ERROR: Maven argument parsing failed\n".toByteArray())
        outputStream.write("Arguments: ${allArguments.joinToString(" ")}\n".toByteArray())
        return 1
      }

      // ResidentMavenInvoker may try to read from stdin - provide empty input to prevent hanging
      val originalIn = System.`in`
      System.setIn(java.io.ByteArrayInputStream(ByteArray(0)))

      val exitCode = try {
        val invokeStartTime = System.currentTimeMillis()
        val result = invokeMethod!!.invoke(invoker, invokerRequest) as Int
        val invokeDuration = System.currentTimeMillis() - invokeStartTime
        log.debug("invoker.invoke() completed in ${invokeDuration}ms, returned: $result")
        result
      } catch (e: NoSuchMethodError) {
        log.error("Maven version incompatibility: ${e.message}", e)
        outputStream.write("EXCEPTION: Maven version incompatibility - ${e.message}\n".toByteArray())
        e.printStackTrace(PrintStream(outputStream, true))
        1
      } catch (e: java.lang.reflect.InvocationTargetException) {
        val cause = e.cause ?: e
        log.error("EXCEPTION during invoker.invoke(): ${cause.javaClass.simpleName}: ${cause.message}", cause)
        System.err.println("[ERROR] EXCEPTION during invoker.invoke(): ${cause.javaClass.simpleName}: ${cause.message}")
        cause.printStackTrace(System.err)
        cause.printStackTrace(PrintStream(outputStream, true))
        1
      } catch (e: Throwable) {
        log.error("EXCEPTION during invoker.invoke(): ${e.javaClass.simpleName}: ${e.message}", e)
        // Also print to stderr so error is visible in test output
        System.err.println("[ERROR] EXCEPTION during invoker.invoke(): ${e.javaClass.simpleName}: ${e.message}")
        e.printStackTrace(System.err)
        e.printStackTrace(PrintStream(outputStream, true))
        1
      } finally {
        System.setIn(originalIn)
      }

      val duration = System.currentTimeMillis() - startTime
      if (exitCode == 0) {
        log.debug("Maven completed in ${duration}ms")
      } else {
        log.debug("Maven failed with exit code $exitCode in ${duration}ms")
      }
      exitCode
    } catch (e: Exception) {
      log.error("Unexpected error executing Maven: ${e.message}", e)
      outputStream.write("ERROR: Unexpected error - ${e.message}\n".toByteArray())
      1
    }
  }

  /**
   * Get the NxMaven instance if it has been created.
   * Returns null if the executor is not initialized or NxMaven is not available.
   */
  fun getNxMaven(): NxMaven? {
    return if (initialized && invoker != null) {
      try {
        val getNxMavenMethod = invoker!!.javaClass.getMethod("getNxMaven")
        getNxMavenMethod.invoke(invoker) as? NxMaven
      } catch (e: Exception) {
        log.warn("Could not get NxMaven: ${e.message}")
        null
      }
    } else {
      null
    }
  }

  override fun shutdown() {
    if (initialized && invoker != null) {
      try {
        closeMethod?.invoke(invoker)
      } catch (e: Exception) {
        log.warn("Error closing invoker: ${e.message}")
      }
      log.info("ResidentMavenExecutor shutdown complete")
    }
  }
}
