package dev.nx.maven.runner

import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.PrintStream
import java.lang.reflect.Method

/**
 * Embedded Maven 3 Executor - keeps Maven instance alive across invocations.
 *
 * This executor has NO compile-time Maven dependencies. It:
 * 1. Uses MavenClassRealm to load Maven JARs from MAVEN_HOME
 * 2. Loads adapter JAR (CachingMaven3Invoker, NxMaven3) into the realm
 * 3. Uses reflection to instantiate and invoke Maven 3 components
 *
 * Architecture:
 * - Maven JARs are loaded from MAVEN_HOME/lib at runtime
 * - Adapter JAR is embedded in batch-runner and loaded into ClassRealm
 * - All Maven interactions happen via reflection
 * - Uses Plexus container (Maven 3) instead of Lookup (Maven 4)
 */
class EmbeddedMaven3Executor(
    private val workspaceRoot: File,
    private val mavenHome: File
) : MavenExecutor {
    private val log = LoggerFactory.getLogger(EmbeddedMaven3Executor::class.java)

    private val mavenRealm: MavenClassRealm
    private val invoker: Any  // CachingMaven3Invoker
    private val invokeMethod: Method
    private var initialized = false
    private var invocationCount = 0

    init {
        log.debug("Initializing EmbeddedMaven3Executor")
        log.debug("Maven home: ${mavenHome.absolutePath}")

        // Configure Maven's logging
        System.setProperty("maven.multiModuleProjectDirectory", workspaceRoot.absolutePath)
        System.setProperty("maven.home", mavenHome.absolutePath)

        // Create realm and load Maven + adapter JAR
        mavenRealm = MavenClassRealm.create(mavenHome)
        mavenRealm.loadAdapterJar("3")

        // Create invoker via reflection
        log.debug("Creating CachingMaven3Invoker via reflection...")
        invoker = createInvoker()

        // Cache method references
        invokeMethod = invoker.javaClass.getMethod(
            "invoke",
            Array<String>::class.java,
            File::class.java,
            java.io.OutputStream::class.java,
            java.io.OutputStream::class.java
        )

        initialized = true
        log.debug("EmbeddedMaven3Executor ready")
    }

    /**
     * Create the CachingMaven3Invoker via reflection.
     */
    private fun createInvoker(): Any {
        // Load required classes
        val classWorldClass = mavenRealm.loadClass("org.codehaus.plexus.classworlds.ClassWorld")
        val cachingInvokerClass = mavenRealm.loadClass("dev.nx.maven.adapter.maven3.CachingMaven3Invoker")

        // Create CachingMaven3Invoker(classWorld, workspaceRoot)
        val invokerConstructor = cachingInvokerClass.getConstructor(classWorldClass, File::class.java)
        val createdInvoker = invokerConstructor.newInstance(mavenRealm.classWorld, workspaceRoot)

        log.debug("Created CachingMaven3Invoker via reflection")
        return createdInvoker
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

            log.debug("Executing Maven with args: ${allArguments.joinToString(" ")} from directory: $workingDir")

            // Invoke Maven
            val exitCode = try {
                val invokeStartTime = System.currentTimeMillis()
                val result = invokeMethod.invoke(
                    invoker,
                    allArguments.toTypedArray(),
                    workingDir,
                    streamingOutput,
                    streamingOutput
                ) as Int
                val invokeDuration = System.currentTimeMillis() - invokeStartTime
                log.debug("invoker.invoke() completed in ${invokeDuration}ms, returned: $result")
                result
            } catch (e: java.lang.reflect.InvocationTargetException) {
                val cause = e.cause ?: e
                log.error("EXCEPTION during invoker.invoke(): ${cause.javaClass.simpleName}: ${cause.message}", cause)
                cause.printStackTrace(PrintStream(outputStream, true))
                1
            } catch (e: Throwable) {
                log.error("EXCEPTION during invoker.invoke(): ${e.javaClass.simpleName}: ${e.message}", e)
                e.printStackTrace(PrintStream(outputStream, true))
                1
            }

            val duration = System.currentTimeMillis() - startTime
            if (exitCode == 0) {
                log.debug("Maven 3 completed in ${duration}ms")
            } else {
                log.debug("Maven 3 failed with exit code $exitCode in ${duration}ms")
            }
            exitCode
        } catch (e: Exception) {
            log.error("Unexpected error executing Maven 3: ${e.message}", e)
            outputStream.write("ERROR: Unexpected error - ${e.message}\n".toByteArray())
            1
        }
    }

    /**
     * Get the NxMaven3 instance if it has been created.
     */
    fun getNxMaven(): Any? {
        return try {
            val getNxMavenMethod = invoker.javaClass.getMethod("getNxMaven")
            getNxMavenMethod.invoke(invoker)
        } catch (e: Exception) {
            log.debug("Could not get NxMaven3: ${e.message}")
            null
        }
    }

    /**
     * Record build states for the specified projects.
     */
    fun recordBuildStates(projectSelectors: Set<String>) {
        try {
            val recordMethod = invoker.javaClass.getMethod("recordBuildStates", Set::class.java)
            recordMethod.invoke(invoker, projectSelectors)
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
            log.info("EmbeddedMaven3Executor shutdown complete")
        }
    }
}
