package dev.nx.maven.runner

import dev.nx.maven.adapter.AdapterInvoker
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Resident Maven 4 Executor - keeps Maven instance alive across invocations.
 *
 * This executor loads Maven 4 classes at runtime via ClassRealm and uses
 * the AdapterInvoker interface to communicate with the adapter JAR.
 *
 * Architecture:
 * - Maven JARs are loaded from MAVEN_HOME/lib at runtime
 * - Adapter JAR is loaded from nx-maven-adapters directory
 * - Adapter implements AdapterInvoker interface (no reflection needed)
 * - Wraps Maven 4's ResidentMavenInvoker for context caching
 */
class ResidentMavenExecutor(
    private val workspaceRoot: File,
    private val mavenHome: File,
    private val mavenMajorVersion: String
) : MavenExecutor {
    private val log = LoggerFactory.getLogger(ResidentMavenExecutor::class.java)

    private val mavenRealm: MavenClassRealm
    private val invoker: AdapterInvoker
    private var invocationCount = 0

    init {
        log.debug("Initializing ResidentMavenExecutor for Maven $mavenMajorVersion")
        log.debug("Maven home: ${mavenHome.absolutePath}")

        // Configure Maven's logging
        System.setProperty("maven.logger.showThreadName", "false")
        System.setProperty("maven.logger.showDateTime", "false")
        System.setProperty("maven.logger.showLogName", "false")
        System.setProperty("maven.logger.levelInBrackets", "true")
        System.setProperty("style.color", "always")
        System.setProperty("jansi.force", "true")
        System.setProperty("maven.home", mavenHome.absolutePath)

        // Create realm and load Maven + adapter JAR
        mavenRealm = MavenClassRealm.create(mavenHome)
        mavenRealm.loadAdapterJar(mavenMajorVersion)

        // Create invoker - ClassRealm delegates to parent classloader for AdapterInvoker interface
        log.debug("Creating Maven4AdapterInvoker...")
        invoker = createInvoker()

        log.debug("ResidentMavenExecutor ready")
    }

    private fun createInvoker(): AdapterInvoker {
        val classWorldClass = mavenRealm.loadClass("org.codehaus.plexus.classworlds.ClassWorld")
        val adapterClass = mavenRealm.loadClass("dev.nx.maven.adapter.maven4.Maven4AdapterInvoker")

        val constructor = adapterClass.getConstructor(classWorldClass, File::class.java)
        return constructor.newInstance(mavenRealm.classWorld, mavenHome) as AdapterInvoker
    }

    override fun execute(
        goals: List<String>,
        arguments: List<String>,
        workingDir: File,
        outputStream: ByteArrayOutputStream
    ): Int {
        invocationCount++
        log.debug("execute() Invocation #$invocationCount with goals: $goals")
        val startTime = System.currentTimeMillis()

        val streamingOutput = TeeOutputStream(outputStream)

        val allArguments = goals + arguments
        log.debug("Executing Maven with goals: $goals, arguments: $arguments from directory: $workingDir")

        val exitCode = invoker.invoke(allArguments, workingDir, streamingOutput, streamingOutput)

        val duration = System.currentTimeMillis() - startTime
        if (exitCode == 0) {
            log.info("Maven execution completed in ${duration}ms with exit code: $exitCode")
        } else {
            log.info("Maven execution FAILED in ${duration}ms with exit code: $exitCode")
        }
        return exitCode
    }

    fun recordBuildStates(projectSelectors: Set<String>) {
        invoker.recordBuildStates(projectSelectors)
    }

    override fun shutdown() {
        invoker.close()
        mavenRealm.close()
        log.info("ResidentMavenExecutor shutdown complete")
    }
}
