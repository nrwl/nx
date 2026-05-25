package dev.nx.maven.adapter.maven3

import dev.nx.maven.adapter.AdapterInvoker
import org.apache.maven.execution.DefaultMavenExecutionRequest
import org.apache.maven.execution.MavenExecutionRequest
import org.apache.maven.execution.MavenExecutionRequestPopulationException
import org.apache.maven.execution.MavenExecutionRequestPopulator
import org.apache.maven.settings.building.DefaultSettingsBuildingRequest
import org.apache.maven.settings.building.SettingsBuilder
import org.apache.maven.settings.building.SettingsBuildingException
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
import java.io.FileNotFoundException
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
    private var settingsBuilder: SettingsBuilder? = null
    private var graphSetup = false

    init {
        initialize()
    }

    private fun initialize() {
        log.debug("Initializing CachingMaven3Invoker...")

        System.setProperty("maven.multiModuleProjectDirectory", workspaceRoot.absolutePath)

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
        settingsBuilder = try {
            c.lookup(SettingsBuilder::class.java)
        } catch (e: Exception) {
            log.warn("SettingsBuilder lookup failed; settings.xml merge will be skipped: ${e.message}")
            null
        }

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

    @Synchronized
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
        if (request.userProperties == null) {
            request.userProperties = java.util.Properties()
        }

        val goals = mutableListOf<String>()
        val selectedProjects = mutableListOf<String>()
        var userSettingsOverride: File? = null
        var globalSettingsOverride: File? = null
        var i = 0
        while (i < args.size) {
            when (val arg = args[i]) {
                "-pl", "--projects" -> {
                    if (i + 1 < args.size) selectedProjects.addAll(args[++i].split(","))
                }
                "-s", "--settings" -> {
                    if (i + 1 < args.size) {
                        userSettingsOverride = resolveSettingsFile(args[++i], workingDir)
                    }
                }
                "-gs", "--global-settings" -> {
                    if (i + 1 < args.size) {
                        globalSettingsOverride = resolveSettingsFile(args[++i], workingDir)
                    }
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

        mergeEffectiveSettings(request, userSettingsOverride, globalSettingsOverride)

        System.getProperty("maven.repo.local")?.let { path ->
            request.localRepositoryPath = File(path)
        }

        try {
            requestPopulator?.populateDefaults(request)
        } catch (e: Exception) {
            log.warn("Failed to populate request defaults: ${e.message}")
        }

        return request
    }

    /**
     * Loads global + user settings.xml (mirrors, proxies, servers, profiles, etc.) the same way
     * [org.apache.maven.cli.configuration.SettingsXmlConfigurationProcessor] does for the `mvn` CLI,
     * then merges them into the execution request via [MavenExecutionRequestPopulator.populateFromSettings].
     */
    private fun mergeEffectiveSettings(
        request: MavenExecutionRequest,
        userSettingsOverride: File?,
        globalSettingsOverride: File?
    ) {
        val builder = settingsBuilder
        if (builder == null) {
            log.warn("Skipping settings.xml merge (SettingsBuilder unavailable)")
            return
        }

        userSettingsOverride?.let {
            if (!it.isFile) {
                throw FileNotFoundException(
                    "The specified user settings file does not exist: ${it.absolutePath}"
                )
            }
        }
        globalSettingsOverride?.let {
            if (!it.isFile) {
                throw FileNotFoundException(
                    "The specified global settings file does not exist: ${it.absolutePath}"
                )
            }
        }

        val userHome = System.getProperty("user.home")
        val userSettingsFile = userSettingsOverride
            ?: File(userHome, ".m2/settings.xml")
        val globalSettingsFile = globalSettingsOverride
            ?: System.getProperty("maven.conf")?.let { File(it, "settings.xml") }

        request.setUserSettingsFile(userSettingsFile)
        if (globalSettingsFile != null) {
            request.setGlobalSettingsFile(globalSettingsFile)
        }

        val settingsRequest = DefaultSettingsBuildingRequest()
        settingsRequest.globalSettingsFile = globalSettingsFile
        settingsRequest.userSettingsFile = userSettingsFile
        settingsRequest.systemProperties = request.systemProperties
        settingsRequest.userProperties = request.userProperties

        val populator = requestPopulator
        if (populator == null) {
            log.warn("MavenExecutionRequestPopulator unavailable; skipping settings application")
            return
        }

        try {
            val result = builder.build(settingsRequest)
            for (problem in result.problems) {
                log.warn("Settings problem: {} @ {}", problem.message, problem.location)
            }
            populator.populateFromSettings(request, result.effectiveSettings)
        } catch (e: SettingsBuildingException) {
            log.error("Failed to build effective Maven settings: ${e.message}", e)
            throw e
        } catch (e: MavenExecutionRequestPopulationException) {
            log.error("Failed to apply Maven settings to execution request: ${e.message}", e)
            throw e
        }
    }

    private fun resolveSettingsFile(path: String, workingDir: File): File {
        val f = File(path)
        return if (f.isAbsolute) f else File(workingDir, path).absoluteFile
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
