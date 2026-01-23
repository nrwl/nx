package dev.nx.maven.adapter.maven3

import dev.nx.maven.shared.BuildStateManager
import org.apache.maven.DefaultMaven
import org.apache.maven.Maven
import org.apache.maven.execution.*
import org.apache.maven.graph.GraphBuilder
import org.apache.maven.lifecycle.internal.ExecutionEventCatapult
import org.apache.maven.lifecycle.internal.LifecycleStarter
import org.apache.maven.plugin.LegacySupport
import org.apache.maven.project.MavenProject
import org.apache.maven.project.MavenProjectHelper
import org.apache.maven.session.scope.internal.SessionScope
import org.codehaus.plexus.PlexusContainer
import org.eclipse.aether.RepositorySystemSession
import org.slf4j.LoggerFactory
import java.util.concurrent.atomic.AtomicInteger

/**
 * Nx Maven service for Maven 3.x that extends DefaultMaven and preserves session state across invocations.
 *
 * Similar to NxMaven (Maven 4), this class caches the project dependency graph and repository session
 * to enable efficient batch execution without rebuilding the graph for each invocation.
 *
 * Key differences from Maven 4:
 * - Uses PlexusContainer instead of Lookup
 * - No InternalSession - uses MavenSession directly
 * - Uses reflection to copy injected fields from the container's DefaultMaven instance
 */
class NxMaven3(
    private val container: PlexusContainer,
    private val eventCatapult: ExecutionEventCatapult,
    private val legacySupport: LegacySupport,
    private val sessionScope: SessionScope,
    private val graphBuilder: GraphBuilder,
    private val lifecycleStarter: LifecycleStarter
) : DefaultMaven() {
    private val log = LoggerFactory.getLogger(NxMaven3::class.java)
    private val executionCount = AtomicInteger(0)

    @Volatile
    private var cachedProjectGraph: ProjectDependencyGraph? = null

    @Volatile
    private var cachedRepositorySession: RepositorySystemSession? = null

    @Volatile
    private var cachedMavenSession: MavenSession? = null

    private val getProjectMapMethod by lazy {
        DefaultMaven::class.java.getDeclaredMethod(
            "getProjectMap",
            Collection::class.java
        ).apply { isAccessible = true }
    }

    init {
        log.debug("NxMaven3 initializing - copying injected fields from container's DefaultMaven...")
        copyInjectedFields()
        log.debug("NxMaven3 initialized - will use cached graph for batch execution")
        // Initialize BuildStateManager with MavenProjectHelper
        val projectHelper = try {
            container.lookup(MavenProjectHelper::class.java)
        } catch (e: Exception) {
            log.warn("Failed to lookup MavenProjectHelper: ${e.message}")
            null
        }
        BuildStateManager.initialize(projectHelper)
    }

    /**
     * Copy injected fields from the container's DefaultMaven instance to this instance.
     * This is necessary because Maven 3 uses field injection, not constructor injection.
     */
    private fun copyInjectedFields() {
        try {
            // Lookup the container's DefaultMaven instance (properly wired by Plexus)
            val defaultMaven = container.lookup(Maven::class.java) as DefaultMaven

            // Get all declared fields from DefaultMaven and copy them
            val defaultMavenClass = DefaultMaven::class.java
            for (field in defaultMavenClass.declaredFields) {
                if (java.lang.reflect.Modifier.isStatic(field.modifiers)) continue
                if (java.lang.reflect.Modifier.isFinal(field.modifiers)) continue

                try {
                    field.isAccessible = true
                    val value = field.get(defaultMaven)
                    if (value != null) {
                        field.set(this, value)
                        log.debug("  Copied field: ${field.name}")
                    }
                } catch (e: Exception) {
                    log.debug("  Could not copy field ${field.name}: ${e.message}")
                }
            }
            log.debug("Field copying complete")
        } catch (e: Exception) {
            log.error("Failed to copy injected fields: ${e.message}", e)
            throw RuntimeException("Failed to initialize NxMaven3 - could not copy injected fields", e)
        }
    }

    /**
     * Set up the project dependency graph cache using the first real Maven request.
     * This should be called before any execute() calls.
     */
    @Synchronized
    fun setupGraphCache(request: MavenExecutionRequest) {
        if (cachedProjectGraph != null) {
            log.debug("Graph cache already setup - skipping rebuild")
            return
        }

        log.debug("🏗️ Setting up project graph cache for Maven 3...")
        val setupStartTime = System.currentTimeMillis()

        // Set our custom execution listener to suppress verbose output during graph building
        request.executionListener = BatchExecutionListener()

        request.isRecursive = true

        // Ensure system properties are available for profile activation (especially java.version)
        if (request.systemProperties == null || request.systemProperties.isEmpty()) {
            request.systemProperties = java.util.Properties()
        }
        // Copy all Java system properties to the request
        System.getProperties().forEach { key, value ->
            if (request.systemProperties.getProperty(key.toString()) == null) {
                request.systemProperties.setProperty(key.toString(), value.toString())
            }
        }
        log.debug("   Added ${request.systemProperties.size} system properties to request")

        // Create repository session using the parent's method (now properly injected)
        val repositorySession = newRepositorySession(request)
        cachedRepositorySession = repositorySession

        // Create Maven session
        val result = DefaultMavenExecutionResult()
        val session = MavenSession(container, repositorySession, request, result)
        cachedMavenSession = session

        sessionScope.enter()
        try {
            sessionScope.seed(MavenSession::class.java, session)

            // Build the project graph
            val graphBuildStartTime = System.currentTimeMillis()
            val graphResult = graphBuilder.build(session)
            val graphBuildTimeMs = System.currentTimeMillis() - graphBuildStartTime
            log.debug("   ✅ Graph build completed in ${graphBuildTimeMs}ms")

            if (graphResult.hasErrors()) {
                log.warn("   ⚠️ Graph build had errors:")
                graphResult.problems.forEach { problem ->
                    log.warn("      Problem: ${problem.message}")
                }
            }

            val graph = graphResult.get()
            if (graph == null) {
                // Graph building failed - this can happen due to strict profile validation
                // Set a flag to use non-cached mode and return
                log.warn("   Failed to build project graph - will fall back to non-cached execution mode")
                log.warn("   This typically happens due to profile validation warnings in dependency POMs")
                return
            }
            cachedProjectGraph = graph

            // Set up the session with the graph
            session.projects = graph.sortedProjects
            session.allProjects = graph.allProjects
            session.projectDependencyGraph = graph

            log.debug("   ✅ Graph cache setup complete with ${graph.allProjects.size} projects")
            graph.sortedProjects?.forEach { project ->
                log.debug("      - ${project.groupId}:${project.artifactId}")
            }

            // Apply existing build states to all projects
            log.debug("   🔄 Applying existing build states to ${graph.allProjects.size} projects...")
            val applyStartTime = System.currentTimeMillis()
            BuildStateManager.applyBuildStates(graph.allProjects)
            val applyTimeMs = System.currentTimeMillis() - applyStartTime
            log.debug("   ✅ Build state application completed in ${applyTimeMs}ms")

        } finally {
            sessionScope.exit()
            val totalSetupTimeMs = System.currentTimeMillis() - setupStartTime
            log.debug("   Total graph cache setup time: ${totalSetupTimeMs}ms")
        }
    }

    override fun execute(request: MavenExecutionRequest): MavenExecutionResult {
        val count = executionCount.incrementAndGet()
        val invokeStartTime = System.currentTimeMillis()

        // Set our custom execution listener for batch builds (before any events fire)
        request.executionListener = BatchExecutionListener()

        // If graph cache failed, fall back to standard DefaultMaven execution
        val result = if (cachedProjectGraph != null) {
            executeWithCachedGraph(request)
        } else {
            log.debug("Using fallback DefaultMaven.execute() - no cached graph available")
            super.execute(request)
        }

        val invokeTimeMs = System.currentTimeMillis() - invokeStartTime
        log.debug("NxMaven3.execute() invocation #$count completed in ${invokeTimeMs}ms")
        return result
    }

    /**
     * Executes the build using our cached graph and session.
     */
    private fun executeWithCachedGraph(request: MavenExecutionRequest): MavenExecutionResult {
        val result = DefaultMavenExecutionResult()
        sessionScope.enter()

        try {
            // Create a new session using the cached repository session
            val session = MavenSession(
                container,
                cachedRepositorySession!!,
                request,
                result
            )
            // Apply the cached graph to the session
            applyGraphToSession(session, cachedProjectGraph!!, request)

            // Seed the session into scope
            sessionScope.seed(MavenSession::class.java, session)
            legacySupport.session = session

            // Fire project discovery event
            eventCatapult.fire(ExecutionEvent.Type.ProjectDiscoveryStarted, session, null)

            // Set result properties
            result.topologicallySortedProjects = session.projects
            result.project = session.topLevelProject

            // Execute the lifecycle
            lifecycleStarter.execute(session)

            // Record build state after successful execution
            if (!result.hasExceptions()) {
                session.projects?.forEach { project ->
                    try {
                        BuildStateManager.recordBuildState(project)
                    } catch (e: Exception) {
                        log.warn("Failed to record build state for ${project.groupId}:${project.artifactId}: ${e.message}")
                    }
                }
            }

            // Log exceptions
            if (result.hasExceptions()) {
                log.error("Build completed with ${result.exceptions.size} exception(s):")
                for (e in result.exceptions) {
                    log.error("Exception: ${e.message}", e)
                }
            }

            return result
        } catch (e: Exception) {
            log.error("   Error executing with cached session: ${e.message}", e)
            result.addException(e)
            return result
        } finally {
            legacySupport.session = null
            sessionScope.exit()
        }
    }

    private fun applyGraphToSession(
        session: MavenSession,
        graph: ProjectDependencyGraph,
        request: MavenExecutionRequest
    ) {
        log.debug("Applying project dependency graph to session for ${request.pom}: ${request.goals}")

        session.allProjects = graph.allProjects
        session.projectDependencyGraph = graph

        // Find the selected project(s) to build
        val selectedProjects = if (request.selectedProjects.isNotEmpty()) {
            graph.allProjects.filter { project ->
                request.selectedProjects.any { selector ->
                    "${project.groupId}:${project.artifactId}" == selector ||
                    project.artifactId == selector
                }
            }
        } else {
            // If no specific projects selected, find the project matching the POM
            graph.allProjects.filter { project ->
                project.file?.absolutePath == request.pom?.absolutePath
            }.ifEmpty {
                // Fallback to all projects if no match found
                graph.sortedProjects ?: emptyList()
            }
        }

        session.projects = selectedProjects
        session.currentProject = selectedProjects.firstOrNull()

        // Apply build state to selected projects before execution
        log.debug("Applying build states to ${selectedProjects.size} selected projects before execution...")
        BuildStateManager.applyBuildStates(selectedProjects)

        @Suppress("UNCHECKED_CAST")
        session.projectMap = getProjectMapMethod.invoke(this, selectedProjects) as Map<String, MavenProject>?
    }

    /**
     * Record build states for the specified projects.
     */
    fun recordBuildStates(projectSelectors: Set<String>) {
        if (cachedProjectGraph == null) {
            log.warn("Cannot record build states - project graph not cached")
            return
        }

        val startTime = System.currentTimeMillis()
        log.debug("Recording build states for ${projectSelectors.size} projects...")

        var recordedCount = 0
        var failedCount = 0

        projectSelectors.forEach { selector ->
            val project = cachedProjectGraph!!.allProjects.find { p ->
                "${p.groupId}:${p.artifactId}" == selector
            }

            if (project != null) {
                try {
                    BuildStateManager.recordBuildState(project)
                    recordedCount++
                } catch (e: Exception) {
                    log.warn("  Failed to record build state for $selector: ${e.message}")
                    failedCount++
                }
            } else {
                log.warn("  Project not found for selector: $selector")
                failedCount++
            }
        }

        val duration = System.currentTimeMillis() - startTime
        log.debug("Build state recording completed: $recordedCount succeeded, $failedCount failed (took ${duration}ms)")
    }
}
