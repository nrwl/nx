package dev.nx.maven.adapter.maven3

import dev.nx.maven.adapter.AdapterInvoker
import org.apache.maven.execution.DefaultMavenExecutionRequest
import org.apache.maven.execution.MavenExecutionRequest
import org.apache.maven.execution.MavenExecutionRequestPopulator
import org.apache.maven.graph.GraphBuilder
import org.apache.maven.lifecycle.internal.ExecutionEventCatapult
import org.apache.maven.lifecycle.internal.LifecycleStarter
import org.apache.maven.plugin.LegacySupport
import org.apache.maven.session.scope.internal.SessionScope
import org.codehaus.plexus.DefaultContainerConfiguration
import org.codehaus.plexus.DefaultPlexusContainer
import org.codehaus.plexus.PlexusConstants
import org.codehaus.plexus.classworlds.ClassWorld
import org.codehaus.plexus.classworlds.realm.ClassRealm
import org.slf4j.LoggerFactory
import java.io.File
import java.io.OutputStream
import java.io.PrintStream

/**
 * Caching Maven 3 invoker that reuses a PlexusContainer and NxMaven3 instance
 * across invocations to preserve build state for sequential phase execution.
 */
class CachingMaven3Invoker(
    private val classWorld: ClassWorld,
    private val workspaceRoot: File
) : AdapterInvoker {

    private val log = LoggerFactory.getLogger(CachingMaven3Invoker::class.java)

    private var container: DefaultPlexusContainer? = null
    private var nxMaven: NxMaven3? = null
    private var requestPopulator: MavenExecutionRequestPopulator? = null
    private var graphSetup = false

    init {
        initialize()
    }

    private fun initialize() {
        log.debug("Initializing CachingMaven3Invoker...")

        System.setProperty("maven.multiModuleProjectDirectory", workspaceRoot.absolutePath)
        System.setProperty("maven.home", System.getenv("MAVEN_HOME") ?: "")

        val coreRealm = classWorld.getRealm("plexus.core") as ClassRealm

        container = DefaultPlexusContainer(
            DefaultContainerConfiguration()
                .setClassWorld(classWorld)
                .setRealm(coreRealm)
                .setClassPathScanning(PlexusConstants.SCANNING_INDEX)
                .setAutoWiring(true)
                .setJSR250Lifecycle(true)
                .setName("maven")
        )

        val c = container!!
        requestPopulator = c.lookup(MavenExecutionRequestPopulator::class.java)

        nxMaven = NxMaven3(
            c,
            c.lookup(ExecutionEventCatapult::class.java),
            c.lookup(LegacySupport::class.java),
            c.lookup(SessionScope::class.java),
            c.lookup(GraphBuilder::class.java),
            c.lookup(LifecycleStarter::class.java)
        )

        log.debug("CachingMaven3Invoker initialized")
    }

    override fun invoke(
        args: List<String>,
        workingDir: File,
        stdout: OutputStream,
        stderr: OutputStream
    ): Int {
        log.debug("invoke() with args: ${args.joinToString(" ")}")

        val originalOut = System.out
        val originalErr = System.err
        val printStreamOut = PrintStream(stdout, true)
        val printStreamErr = PrintStream(stderr, true)
        System.setOut(printStreamOut)
        System.setErr(printStreamErr)

        return try {
            val request = createRequest(args, workingDir)

            if (!graphSetup) {
                nxMaven!!.setupGraphCache(request)
                graphSetup = true
            }

            val result = nxMaven!!.execute(request)
            val exitCode = if (result.hasExceptions()) 1 else 0

            if (exitCode != 0) {
                result.exceptions.forEach { e ->
                    printStreamErr.println("ERROR: ${e.message}")
                }
            }

            exitCode
        } catch (e: Exception) {
            log.error("Error during Maven invocation: ${e.message}", e)
            printStreamErr.println("ERROR: ${e.message}")
            e.printStackTrace(printStreamErr)
            1
        } finally {
            System.setOut(originalOut)
            System.setErr(originalErr)
        }
    }

    private fun createRequest(args: List<String>, workingDir: File): MavenExecutionRequest {
        val request = DefaultMavenExecutionRequest()
        request.setBaseDirectory(workingDir)
        request.pom = File(workingDir, "pom.xml")
        request.isInteractiveMode = false
        request.setShowErrors(true)

        request.systemProperties = java.util.Properties()
        System.getProperties().forEach { key, value ->
            request.systemProperties.setProperty(key.toString(), value.toString())
        }

        val goals = mutableListOf<String>()
        val selectedProjects = mutableListOf<String>()
        var i = 0
        while (i < args.size) {
            when (val arg = args[i]) {
                "-pl", "--projects" -> {
                    if (i + 1 < args.size) selectedProjects.addAll(args[++i].split(","))
                }
                "-N", "--non-recursive" -> request.isRecursive = false
                "-B", "--batch-mode" -> request.isInteractiveMode = false
                "-e", "--errors" -> request.setShowErrors(true)
                "-X", "--debug" -> request.loggingLevel = MavenExecutionRequest.LOGGING_LEVEL_DEBUG
                "-q", "--quiet" -> request.loggingLevel = MavenExecutionRequest.LOGGING_LEVEL_WARN
                else -> when {
                    arg.startsWith("-D") -> {
                        val prop = arg.substring(2)
                        val eqIndex = prop.indexOf('=')
                        if (eqIndex > 0) {
                            request.systemProperties[prop.substring(0, eqIndex)] = prop.substring(eqIndex + 1)
                        } else {
                            request.systemProperties[prop] = "true"
                        }
                    }
                    !arg.startsWith("-") -> goals.add(arg)
                }
            }
            i++
        }

        request.goals = goals
        if (selectedProjects.isNotEmpty()) {
            request.selectedProjects = selectedProjects
        }

        val localRepoPath = System.getProperty("maven.repo.local")
            ?: "${System.getProperty("user.home")}/.m2/repository"
        request.localRepositoryPath = File(localRepoPath)

        try {
            requestPopulator?.populateDefaults(request)
        } catch (e: Exception) {
            log.warn("Failed to populate request defaults: ${e.message}")
        }

        return request
    }

    override fun recordBuildStates(projectSelectors: Set<String>) {
        nxMaven?.recordBuildStates(projectSelectors)
    }

    override fun close() {
        container?.dispose()
        container = null
        nxMaven = null
        graphSetup = false
    }
}
