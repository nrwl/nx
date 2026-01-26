package dev.nx.maven.runner

import dev.nx.maven.adapter.AdapterInvoker
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Embedded Maven 3 Executor - keeps Maven instance alive across invocations.
 *
 * This executor loads Maven 3 classes at runtime via ClassRealm and uses
 * the AdapterInvoker interface to communicate with the adapter JAR.
 *
 * Architecture:
 * - Maven JARs are loaded from MAVEN_HOME/lib at runtime
 * - Adapter JAR is loaded from nx-maven-adapters directory
 * - Adapter implements AdapterInvoker interface (no reflection needed)
 */
class EmbeddedMaven3Executor(
    private val workspaceRoot: File,
    private val mavenHome: File
) : MavenExecutor {
    private val log = LoggerFactory.getLogger(EmbeddedMaven3Executor::class.java)

    private val mavenRealm: MavenClassRealm
    private val invoker: AdapterInvoker
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

        // Create invoker - ClassRealm delegates to parent classloader for AdapterInvoker interface
        log.debug("Creating CachingMaven3Invoker...")
        invoker = createInvoker()

        log.debug("EmbeddedMaven3Executor ready")
    }

    private fun createInvoker(): AdapterInvoker {
        val classWorldClass = mavenRealm.loadClass("org.codehaus.plexus.classworlds.ClassWorld")
        val cachingInvokerClass = mavenRealm.loadClass("dev.nx.maven.adapter.maven3.CachingMaven3Invoker")

        val constructor = cachingInvokerClass.getConstructor(classWorldClass, File::class.java)
        return constructor.newInstance(mavenRealm.classWorld, workspaceRoot) as AdapterInvoker
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
        log.debug("Executing Maven with args: ${allArguments.joinToString(" ")} from directory: $workingDir")

        val exitCode = invoker.invoke(allArguments, workingDir, streamingOutput, streamingOutput)

        val duration = System.currentTimeMillis() - startTime
        if (exitCode == 0) {
            log.debug("Maven 3 completed in ${duration}ms")
        } else {
            log.debug("Maven 3 failed with exit code $exitCode in ${duration}ms")
        }
        return exitCode
    }

    fun recordBuildStates(projectSelectors: Set<String>) {
        invoker.recordBuildStates(projectSelectors)
    }

    override fun shutdown() {
        invoker.close()
        mavenRealm.close()
        log.info("EmbeddedMaven3Executor shutdown complete")
    }
}
