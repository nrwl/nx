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
 * Caching Maven 3 invoker that uses NxMaven3 for build state management.
 *
 * This invoker:
 * 1. Creates a PlexusContainer with all Maven components
 * 2. Creates NxMaven3 which extends DefaultMaven and adds build state management
 * 3. Reuses the same container and NxMaven3 instance across all invocations
 * 4. Applies build state from previous phases before each execution
 *
 * This enables sequential phase execution (compile -> package -> install) to work correctly
 * by preserving artifact state across invocations.
 */
class CachingMaven3Invoker(
    private val classWorld: ClassWorld,
    private val workspaceRoot: File
) : AutoCloseable {
    private val log = LoggerFactory.getLogger(CachingMaven3Invoker::class.java)

    private var container: PlexusContainer? = null
    private var nxMaven: NxMaven3? = null
    private var requestPopulator: MavenExecutionRequestPopulator? = null
    private var initialized = false
    private var graphSetup = false

    /**
     * Initialize the invoker by creating the PlexusContainer and NxMaven3.
     */
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
            // Create PlexusContainer (similar to how MavenCli does it)
            container = createContainer()
            log.debug("  PlexusContainer created")

            // Lookup required components
            val eventCatapult = container!!.lookup(ExecutionEventCatapult::class.java)
            val legacySupport = container!!.lookup(LegacySupport::class.java)
            val sessionScope = container!!.lookup(SessionScope::class.java)
            val graphBuilder = container!!.lookup(GraphBuilder::class.java)
            val lifecycleStarter = container!!.lookup(LifecycleStarter::class.java)
            requestPopulator = container!!.lookup(MavenExecutionRequestPopulator::class.java)
            log.debug("  Maven components looked up successfully")

            // Create NxMaven3
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

    /**
     * Create the PlexusContainer for Maven components.
     */
    private fun createContainer(): PlexusContainer {
        // Get or create the plexus.core realm
        val coreRealm: ClassRealm = try {
            classWorld.getRealm("plexus.core") as ClassRealm
        } catch (e: Exception) {
            log.debug("plexus.core realm not found, checking existing realms...")
            // Log available realms for debugging
            val existingRealms = classWorld.realms.map { it.id }
            log.debug("Available realms: $existingRealms")

            // Use the first available realm or create a new one
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

    /**
     * Set up the project graph cache for batch execution.
     * This should be called once before the first build.
     */
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

    /**
     * Invoke Maven with the given arguments.
     *
     * @param args Maven CLI arguments
     * @param workingDir Working directory for the build
     * @param stdout Output stream for stdout
     * @param stderr Output stream for stderr
     * @return Exit code (0 = success)
     */
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

        return try {
            // Parse arguments and create request
            val request = createRequest(args, workingDir)

            // Set output stream for execution listener
            nxMaven!!.outputStream = java.io.PrintStream(stdout, true)

            // Set up graph cache on first invocation
            if (!graphSetup) {
                setupGraphCache(request)
            }

            // Execute via NxMaven3
            val result = nxMaven!!.execute(request)

            val duration = System.currentTimeMillis() - startTime
            val exitCode = if (result.hasExceptions()) 1 else 0

            if (exitCode != 0) {
                log.debug("Maven execution failed with exit code $exitCode in ${duration}ms")
                // Write errors to stderr
                result.exceptions.forEach { e ->
                    PrintStream(stderr, true).println("ERROR: ${e.message}")
                }
            } else {
                log.debug("Maven execution succeeded in ${duration}ms")
            }

            exitCode
        } catch (e: Exception) {
            log.error("Error during Maven invocation: ${e.message}", e)
            PrintStream(stderr).println("ERROR: ${e.message}")
            e.printStackTrace(PrintStream(stderr))
            1
        }
    }

    /**
     * Create a MavenExecutionRequest from CLI arguments.
     */
    private fun createRequest(args: Array<String>, workingDir: File): MavenExecutionRequest {
        val request = DefaultMavenExecutionRequest()

        // Set basic properties
        request.setBaseDirectory(workingDir)
        request.pom = File(workingDir, "pom.xml")
        request.isInteractiveMode = false
        request.setShowErrors(true)

        // Copy ALL system properties to the request (critical for profile activation)
        request.systemProperties = java.util.Properties()
        System.getProperties().forEach { key, value ->
            request.systemProperties.setProperty(key.toString(), value.toString())
        }

        // Parse arguments
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
                    // Skip unknown options
                    log.debug("Ignoring unknown option: $arg")
                }
                else -> {
                    // Assume it's a goal
                    goals.add(arg)
                }
            }
            i++
        }

        request.goals = goals
        if (selectedProjects.isNotEmpty()) {
            request.selectedProjects = selectedProjects
        }

        // Set local repository
        val localRepoPath = System.getProperty("maven.repo.local")
            ?: "${System.getProperty("user.home")}/.m2/repository"
        request.localRepositoryPath = File(localRepoPath)

        // Populate with settings and profiles
        try {
            requestPopulator?.populateDefaults(request)
        } catch (e: Exception) {
            log.warn("Failed to populate request defaults: ${e.message}")
        }

        return request
    }

    /**
     * Record build states for the specified projects.
     */
    fun recordBuildStates(projectSelectors: Set<String>) {
        if (nxMaven != null) {
            nxMaven!!.recordBuildStates(projectSelectors)
        } else {
            log.debug("Recording build states skipped - NxMaven3 not initialized")
        }
    }

    /**
     * Get the NxMaven3 instance.
     */
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
