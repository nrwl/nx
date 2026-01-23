package dev.nx.maven.adapter.maven3

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
import org.codehaus.plexus.PlexusContainer
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
) : AutoCloseable {

    companion object {
        init {
            // Configure SLF4J SimpleLogger before Maven initializes its logger
            System.setProperty("org.slf4j.simpleLogger.showThreadName", "false")
            System.setProperty("org.slf4j.simpleLogger.showLogName", "false")
            System.setProperty("org.slf4j.simpleLogger.showShortLogName", "false")
            System.setProperty("org.slf4j.simpleLogger.levelInBrackets", "true")
        }
    }

    private val log = LoggerFactory.getLogger(CachingMaven3Invoker::class.java)

    private var container: PlexusContainer? = null
    private var nxMaven: NxMaven3? = null
    private var requestPopulator: MavenExecutionRequestPopulator? = null
    private var initialized = false
    private var graphSetup = false

    @Synchronized
    fun initialize() {
        if (initialized) {
            log.debug("CachingMaven3Invoker already initialized")
            return
        }

        log.debug("Initializing CachingMaven3Invoker with Plexus container...")
        val startTime = System.currentTimeMillis()

        // Set maven.multiModuleProjectDirectory for proper multi-module support
        System.setProperty("maven.multiModuleProjectDirectory", workspaceRoot.absolutePath)
        System.setProperty("maven.home", System.getenv("MAVEN_HOME") ?: "")

        try {
            container = createContainer()
            log.debug("  PlexusContainer created")

            val eventCatapult = container!!.lookup(ExecutionEventCatapult::class.java)
            val legacySupport = container!!.lookup(LegacySupport::class.java)
            val sessionScope = container!!.lookup(SessionScope::class.java)
            val graphBuilder = container!!.lookup(GraphBuilder::class.java)
            val lifecycleStarter = container!!.lookup(LifecycleStarter::class.java)
            requestPopulator = container!!.lookup(MavenExecutionRequestPopulator::class.java)
            log.debug("  Maven components looked up")

            nxMaven = NxMaven3(
                container!!,
                eventCatapult,
                legacySupport,
                sessionScope,
                graphBuilder,
                lifecycleStarter
            )
            log.debug("  NxMaven3 created")

            initialized = true
            val duration = System.currentTimeMillis() - startTime
            log.debug("CachingMaven3Invoker initialized in ${duration}ms")
        } catch (e: Exception) {
            log.error("Failed to initialize CachingMaven3Invoker: ${e.message}", e)
            throw RuntimeException("Failed to initialize Maven 3 invoker", e)
        }
    }

    private fun createContainer(): PlexusContainer {
        val coreRealm: ClassRealm = try {
            classWorld.getRealm("plexus.core") as ClassRealm
        } catch (e: Exception) {
            log.debug("plexus.core realm not found, checking existing realms...")
            val existingRealms = classWorld.realms.map { it.id }
            log.debug("Available realms: $existingRealms")

            if (existingRealms.isNotEmpty()) {
                val firstRealm = classWorld.realms.first()
                log.debug("Using existing realm: ${firstRealm.id}")
                firstRealm as ClassRealm
            } else {
                log.debug("Creating new plexus.core realm")
                classWorld.newRealm("plexus.core", Thread.currentThread().contextClassLoader)
            }
        }

        val containerConfiguration = DefaultContainerConfiguration()
            .setClassWorld(classWorld)
            .setRealm(coreRealm)
            .setClassPathScanning(PlexusConstants.SCANNING_INDEX)
            .setAutoWiring(true)
            .setJSR250Lifecycle(true)
            .setName("maven")

        return DefaultPlexusContainer(containerConfiguration)
    }

    @Synchronized
    fun setupGraphCache(request: MavenExecutionRequest) {
        if (!initialized) {
            initialize()
        }
        if (graphSetup) {
            log.debug("Graph cache already set up")
            return
        }

        log.debug("Setting up project graph cache...")
        nxMaven!!.setupGraphCache(request)
        graphSetup = true
    }

    fun invoke(
        args: Array<String>,
        workingDir: File,
        stdout: OutputStream,
        stderr: OutputStream
    ): Int {
        if (!initialized) {
            initialize()
        }

        log.debug("invoke() with args: ${args.joinToString(" ")} in ${workingDir.absolutePath}")
        val startTime = System.currentTimeMillis()

        // Redirect System.out/err to capture Maven's SLF4J output
        val originalOut = System.out
        val originalErr = System.err
        val printStreamOut = PrintStream(stdout, true)
        val printStreamErr = PrintStream(stderr, true)
        System.setOut(printStreamOut)
        System.setErr(printStreamErr)

        return try {
            val request = createRequest(args, workingDir)

            if (!graphSetup) {
                setupGraphCache(request)
            }

            val result = nxMaven!!.execute(request)

            val duration = System.currentTimeMillis() - startTime
            val exitCode = if (result.hasExceptions()) 1 else 0

            if (exitCode != 0) {
                log.debug("Maven execution failed with exit code $exitCode in ${duration}ms")
                // Write errors to stderr
                result.exceptions.forEach { e ->
                    printStreamErr.println("ERROR: ${e.message}")
                }
            } else {
                log.debug("Maven execution succeeded in ${duration}ms")
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

    private fun createRequest(args: Array<String>, workingDir: File): MavenExecutionRequest {
        val request = DefaultMavenExecutionRequest()

        request.setBaseDirectory(workingDir)
        request.pom = File(workingDir, "pom.xml")
        request.isInteractiveMode = false
        request.setShowErrors(true)

        // Copy system properties to the request (required for profile activation)
        request.systemProperties = java.util.Properties()
        System.getProperties().forEach { key, value ->
            request.systemProperties.setProperty(key.toString(), value.toString())
        }

        val goals = mutableListOf<String>()
        val selectedProjects = mutableListOf<String>()
        var i = 0
        while (i < args.size) {
            val arg = args[i]
            when {
                arg == "-pl" || arg == "--projects" -> {
                    if (i + 1 < args.size) {
                        selectedProjects.addAll(args[++i].split(","))
                    }
                }
                arg == "-N" || arg == "--non-recursive" -> {
                    request.isRecursive = false
                }
                arg == "-B" || arg == "--batch-mode" -> {
                    request.isInteractiveMode = false
                }
                arg == "-e" || arg == "--errors" -> {
                    request.setShowErrors(true)
                }
                arg == "-X" || arg == "--debug" -> {
                    request.loggingLevel = MavenExecutionRequest.LOGGING_LEVEL_DEBUG
                }
                arg == "-q" || arg == "--quiet" -> {
                    request.loggingLevel = MavenExecutionRequest.LOGGING_LEVEL_WARN
                }
                arg.startsWith("-D") -> {
                    val prop = arg.substring(2)
                    val eqIndex = prop.indexOf('=')
                    if (eqIndex > 0) {
                        request.systemProperties[prop.substring(0, eqIndex)] = prop.substring(eqIndex + 1)
                    } else {
                        request.systemProperties[prop] = "true"
                    }
                }
                arg.startsWith("-") -> {
                    log.debug("Ignoring unknown option: $arg")
                }
                else -> {
                    goals.add(arg)
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

    fun recordBuildStates(projectSelectors: Set<String>) {
        nxMaven?.recordBuildStates(projectSelectors)
            ?: log.debug("Recording build states skipped - NxMaven3 not initialized")
    }

    fun getNxMaven(): NxMaven3? = nxMaven

    override fun close() {
        log.debug("Closing CachingMaven3Invoker...")
        try {
            (container as? DefaultPlexusContainer)?.dispose()
        } catch (e: Exception) {
            log.warn("Error disposing container: ${e.message}")
        }
        container = null
        nxMaven = null
        initialized = false
        graphSetup = false
    }
}
