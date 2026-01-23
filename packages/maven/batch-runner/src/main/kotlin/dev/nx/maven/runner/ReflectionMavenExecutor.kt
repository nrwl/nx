package dev.nx.maven.runner

import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.PrintStream
import java.lang.reflect.Method

/**
 * Maven Executor using reflection to load and invoke Maven classes.
 *
 * This executor has NO compile-time Maven dependencies. It:
 * 1. Uses MavenClassRealm to load Maven JARs from MAVEN_HOME
 * 2. Injects pre-compiled adapter classes (CachingResidentMavenInvoker, NxMaven, etc.)
 * 3. Uses reflection to instantiate and invoke Maven components
 *
 * Architecture:
 * - Maven JARs are loaded from MAVEN_HOME/lib at runtime
 * - Adapter classes are embedded in the batch-runner JAR and injected into the realm
 * - All Maven interactions happen via reflection
 *
 * This allows the batch-runner JAR to be Maven-version-agnostic at compile time,
 * while still supporting full graph caching via NxMaven at runtime.
 */
class ReflectionMavenExecutor(
    private val workspaceRoot: File,
    private val mavenHome: File,
    private val mavenMajorVersion: String
) : MavenExecutor {
    private val log = LoggerFactory.getLogger(ReflectionMavenExecutor::class.java)

    private val mavenRealm: MavenClassRealm
    private val invoker: Any  // CachingResidentMavenInvoker
    private val parser: Any   // MavenParser
    private val invokeMethod: Method
    private val parsingFailedMethod: Method
    private var initialized = false
    private var invocationCount = 0

    init {
        System.err.println("[NX-REFLECTION] Initializing ReflectionMavenExecutor for Maven $mavenMajorVersion")
        System.err.println("[NX-REFLECTION] Maven home: ${mavenHome.absolutePath}")

        // Configure Maven's logging
        System.setProperty("maven.logger.showThreadName", "false")
        System.setProperty("maven.logger.showDateTime", "false")
        System.setProperty("maven.logger.showLogName", "false")
        System.setProperty("maven.logger.levelInBrackets", "true")
        System.setProperty("style.color", "always")
        System.setProperty("jansi.force", "true")
        System.setProperty("maven.home", mavenHome.absolutePath)

        // Create realm and load Maven + adapters
        mavenRealm = MavenClassRealm.create(mavenHome)
        mavenRealm.injectAdapters(mavenMajorVersion)

        // Create invoker via reflection
        val (createdInvoker, createdParser) = createInvokerAndParser()
        invoker = createdInvoker
        parser = createdParser

        // Cache method references
        invokeMethod = invoker.javaClass.getMethod("invoke", mavenRealm.loadClass("org.apache.maven.api.cli.InvokerRequest"))
        parsingFailedMethod = mavenRealm.loadClass("org.apache.maven.api.cli.InvokerRequest").getMethod("parsingFailed")

        initialized = true
        System.err.println("[NX-REFLECTION] ReflectionMavenExecutor ready - NO bundled Maven dependencies!")
    }

    /**
     * Create the CachingResidentMavenInvoker and MavenParser via reflection.
     */
    private fun createInvokerAndParser(): Pair<Any, Any> {
        // Load required classes
        val classWorldClass = mavenRealm.loadClass("org.codehaus.plexus.classworlds.ClassWorld")
        val lookupClass = mavenRealm.loadClass("org.apache.maven.api.services.Lookup")
        val protoLookupClass = mavenRealm.loadClass("org.apache.maven.cling.invoker.ProtoLookup")
        val lookupContextClass = mavenRealm.loadClass("org.apache.maven.cling.invoker.LookupContext")
        val cachingInvokerClass = mavenRealm.loadClass("dev.nx.maven.adapter.maven4.CachingResidentMavenInvoker")
        val mavenParserClass = mavenRealm.loadClass("org.apache.maven.cling.invoker.mvn.MavenParser")

        // Create ProtoLookup with ClassWorld mapping
        val builderMethod = protoLookupClass.getMethod("builder")
        val builder = builderMethod.invoke(null)
        val addMappingMethod = builder.javaClass.getMethod("addMapping", Class::class.java, Any::class.java)
        addMappingMethod.invoke(builder, classWorldClass, mavenRealm.classWorld)
        val buildMethod = builder.javaClass.getMethod("build")
        val protoLookup = buildMethod.invoke(builder)

        // Create CachingResidentMavenInvoker
        val consumerType = java.util.function.Consumer::class.java
        val invokerConstructor = cachingInvokerClass.getConstructor(lookupClass, consumerType)
        val createdInvoker = invokerConstructor.newInstance(protoLookup, null)

        // Create MavenParser
        val parserConstructor = mavenParserClass.getConstructor()
        val createdParser = parserConstructor.newInstance()

        log.debug("Created CachingResidentMavenInvoker and MavenParser via reflection")
        return Pair(createdInvoker, createdParser)
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
            // Build Maven CLI arguments: goals BEFORE options
            val allArguments = ArrayList<String>()
            allArguments.addAll(goals)
            allArguments.addAll(arguments)
            // Force non-interactive/batch mode to avoid SimplexTransferListener deadlock
            // SimplexTransferListener uses blocking queues that can deadlock in embedded mode
            if (!allArguments.contains("-B") && !allArguments.contains("--non-interactive")) {
                allArguments.add("-B")
            }

            log.debug("Executing Maven with goals: $goals, arguments: $arguments from directory: $workingDir")

            // Create ParserRequest via reflection
            val invokerRequest = createInvokerRequest(allArguments, workingDir, streamingOutput)

            // Check if parsing failed
            val parsingFailed = parsingFailedMethod.invoke(invokerRequest) as Boolean
            if (parsingFailed) {
                val errorMessage = "Maven argument parsing failed for: ${allArguments.joinToString(" ")}"
                log.error(errorMessage)
                System.err.println("[ERROR] $errorMessage")
                outputStream.write("ERROR: Maven argument parsing failed\n".toByteArray())
                outputStream.write("Arguments: ${allArguments.joinToString(" ")}\n".toByteArray())
                return 1
            }

            // Invoke Maven - prevent stdin blocking
            val originalIn = System.`in`
            System.setIn(java.io.ByteArrayInputStream(ByteArray(0)))

            val exitCode = try {
                val invokeStartTime = System.currentTimeMillis()
                val result = invokeMethod.invoke(invoker, invokerRequest) as Int
                val invokeDuration = System.currentTimeMillis() - invokeStartTime
                log.debug("invoker.invoke() completed in ${invokeDuration}ms, returned: $result")
                result
            } catch (e: java.lang.reflect.InvocationTargetException) {
                val cause = e.cause ?: e
                log.error("EXCEPTION during invoker.invoke(): ${cause.javaClass.simpleName}: ${cause.message}", cause)
                System.err.println("[ERROR] EXCEPTION during invoker.invoke(): ${cause.javaClass.simpleName}: ${cause.message}")
                cause.printStackTrace(System.err)
                cause.printStackTrace(PrintStream(outputStream, true))
                1
            } catch (e: Throwable) {
                log.error("EXCEPTION during invoker.invoke(): ${e.javaClass.simpleName}: ${e.message}", e)
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
     * Create an InvokerRequest via reflection.
     */
    private fun createInvokerRequest(
        arguments: List<String>,
        workingDir: File,
        output: TeeOutputStream
    ): Any {
        // Load classes
        val parserRequestClass = mavenRealm.loadClass("org.apache.maven.api.cli.ParserRequest")
        val messageBuilderFactoryClass = mavenRealm.loadClass("org.apache.maven.api.services.MessageBuilderFactory")
        val jlineMessageBuilderFactoryClass = mavenRealm.loadClass("org.apache.maven.jline.JLineMessageBuilderFactory")

        // Create JLineMessageBuilderFactory
        val mbfConstructor = jlineMessageBuilderFactoryClass.getConstructor()
        val messageBuilderFactory = mbfConstructor.newInstance()

        // Create ParserRequest using ParserRequest.mvn() builder
        val mvnMethod = parserRequestClass.getMethod("mvn", List::class.java, messageBuilderFactoryClass)
        val builder = mvnMethod.invoke(null, arguments, messageBuilderFactory)

        // Configure builder
        val cwdMethod = builder.javaClass.getMethod("cwd", java.nio.file.Path::class.java)
        val userHomeMethod = builder.javaClass.getMethod("userHome", java.nio.file.Path::class.java)
        val stdOutMethod = builder.javaClass.getMethod("stdOut", java.io.OutputStream::class.java)
        val stdErrMethod = builder.javaClass.getMethod("stdErr", java.io.OutputStream::class.java)
        val embeddedMethod = builder.javaClass.getMethod("embedded", Boolean::class.java)
        val mavenHomeMethod = builder.javaClass.getMethod("mavenHome", java.nio.file.Path::class.java)

        cwdMethod.invoke(builder, workingDir.toPath())
        userHomeMethod.invoke(builder, File(System.getProperty("user.home")).toPath())
        stdOutMethod.invoke(builder, output)
        stdErrMethod.invoke(builder, output)
        embeddedMethod.invoke(builder, true)
        mavenHomeMethod.invoke(builder, mavenHome.toPath())

        val buildMethod = builder.javaClass.getMethod("build")
        val parserRequest = buildMethod.invoke(builder)

        // Parse to get InvokerRequest
        val parseInvocationMethod = parser.javaClass.getMethod("parseInvocation", parserRequestClass)
        return parseInvocationMethod.invoke(parser, parserRequest)
    }

    /**
     * Get the NxMaven instance if it has been created.
     * Returns null if NxMaven is not available.
     */
    fun getNxMaven(): Any? {
        return try {
            val getNxMavenMethod = invoker.javaClass.getMethod("getNxMaven")
            getNxMavenMethod.invoke(invoker)
        } catch (e: Exception) {
            log.debug("Could not get NxMaven: ${e.message}")
            null
        }
    }

    /**
     * Record build states for the specified projects.
     * Each project selector should be in the format "groupId:artifactId".
     */
    fun recordBuildStates(projectSelectors: Set<String>) {
        val nxMaven = getNxMaven()
        if (nxMaven == null) {
            log.warn("Cannot record build states - NxMaven not available")
            return
        }

        try {
            val recordMethod = nxMaven.javaClass.getMethod("recordBuildStates", Set::class.java)
            recordMethod.invoke(nxMaven, projectSelectors)
        } catch (e: Exception) {
            log.error("Failed to record build states: ${e.message}", e)
        }
    }

    override fun shutdown() {
        if (initialized) {
            try {
                val closeMethod = invoker.javaClass.getMethod("close")
                closeMethod.invoke(invoker)
            } catch (e: Exception) {
                log.warn("Error closing invoker: ${e.message}")
            }

            mavenRealm.close()
            log.info("ReflectionMavenExecutor shutdown complete")
        }
    }
}
