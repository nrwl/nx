package dev.nx.maven.runner

import dev.nx.maven.adapter.AdapterInvoker
import org.slf4j.LoggerFactory
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Resident Maven Executor - keeps Maven instance alive across invocations.
 *
 * Supports both Maven 3.x and 4.x by loading the appropriate adapter at runtime.
 *
 * Architecture:
 * - Maven JARs are loaded from MAVEN_HOME/lib at runtime
 * - Adapter JAR is loaded from nx-maven-adapters directory
 * - Adapter implements AdapterInvoker interface (no reflection needed for method calls)
 */
class ResidentMavenExecutor(
    private val workspaceRoot: File,
    private val mavenHome: File,
    private val mavenMajorVersion: String
) : MavenExecutor {
    private val log = LoggerFactory.getLogger(ResidentMavenExecutor::class.java)

    private val mavenRealm: MavenClassRealm
    private val invoker: AdapterInvoker

    init {
        log.debug("Initializing ResidentMavenExecutor for Maven $mavenMajorVersion")
        configureSystemProperties()

        mavenRealm = MavenClassRealm.create(mavenHome)
        try {
            // TCCL needed for adapter loading and invoker creation
            invoker = mavenRealm.withContextClassLoader {
                mavenRealm.loadAdapterJar(mavenMajorVersion)
                createInvoker()
            }
        } catch (e: Exception) {
            mavenRealm.close()
            throw e
        }
    }

    private fun configureSystemProperties() {
        System.setProperty("maven.home", mavenHome.absolutePath)
        System.setProperty("maven.multiModuleProjectDirectory", workspaceRoot.absolutePath)

        if (mavenMajorVersion == "4") {
            System.setProperty("maven.logger.showThreadName", "false")
            System.setProperty("maven.logger.showDateTime", "false")
            System.setProperty("maven.logger.showLogName", "false")
            System.setProperty("maven.logger.levelInBrackets", "true")
            System.setProperty("style.color", "always")
            System.setProperty("jansi.force", "true")
        }
    }

    private fun createInvoker(): AdapterInvoker {
        val classWorldClass = mavenRealm.loadClass("org.codehaus.plexus.classworlds.ClassWorld")

        val (adapterClassName, constructorArg) = when (mavenMajorVersion) {
            "3" -> "dev.nx.maven.adapter.maven3.CachingMaven3Invoker" to workspaceRoot
            else -> "dev.nx.maven.adapter.maven4.Maven4AdapterInvoker" to mavenHome
        }

        val adapterClass = mavenRealm.loadClass(adapterClassName)
        val constructor = adapterClass.getConstructor(classWorldClass, File::class.java)
        return constructor.newInstance(mavenRealm.classWorld, constructorArg) as AdapterInvoker
    }

    override fun execute(
        goals: List<String>,
        arguments: List<String>,
        workingDir: File,
        outputStream: ByteArrayOutputStream
    ): Int {
        val allArguments = goals + arguments
        return invoker.invoke(allArguments, workingDir, TeeOutputStream(outputStream), TeeOutputStream(outputStream))
    }

    fun recordBuildStates(projectSelectors: Set<String>) {
        invoker.recordBuildStates(projectSelectors)
    }

    override fun shutdown() {
        invoker.close()
        mavenRealm.close()
        log.debug("ResidentMavenExecutor shutdown complete")
    }

    override fun <T> withClassLoaderContext(action: () -> T): T =
        mavenRealm.withContextClassLoader(action)
}
