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

/**
 * Nx Maven 3.x executor that caches project graph and session across invocations.
 *
 * Uses reflection in copyInjectedFields() because Maven 3's DefaultMaven uses Plexus
 * field injection - we must copy those injected dependencies to our subclass instance.
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

    @Volatile private var cachedProjectGraph: ProjectDependencyGraph? = null
    @Volatile private var cachedRepositorySession: RepositorySystemSession? = null

    init {
        if (System.getProperty("org.slf4j.simpleLogger.defaultLogLevel") == null) {
            System.setProperty("org.slf4j.simpleLogger.defaultLogLevel", "info")
        }
        copyInjectedFields()

        val projectHelper = try {
            container.lookup(MavenProjectHelper::class.java)
        } catch (_: Exception) { null }
        BuildStateManager.initialize(projectHelper)
    }

    /**
     * Copy injected fields from the container's DefaultMaven instance.
     * Required because Maven 3 uses field injection, not constructor injection.
     */
    private fun copyInjectedFields() {
        val defaultMaven = container.lookup(Maven::class.java) as DefaultMaven

        for (field in DefaultMaven::class.java.declaredFields) {
            if (java.lang.reflect.Modifier.isStatic(field.modifiers)) continue
            if (java.lang.reflect.Modifier.isFinal(field.modifiers)) continue

            try {
                field.isAccessible = true
                field.get(defaultMaven)?.let { field.set(this, it) }
            } catch (_: Exception) { }
        }
    }

    /**
     * Set up the project dependency graph cache using the first real Maven request.
     */
    @Synchronized
    fun setupGraphCache(request: MavenExecutionRequest) {
        if (cachedProjectGraph != null) return

        request.executionListener = BatchExecutionListener()
        request.isRecursive = true
        ensureSystemProperties(request)

        cachedRepositorySession = newRepositorySession(request)
        val result = DefaultMavenExecutionResult()
        val session = MavenSession(container, cachedRepositorySession, request, result)

        sessionScope.enter()
        try {
            sessionScope.seed(MavenSession::class.java, session)

            val graphResult = graphBuilder.build(session)
            if (graphResult.hasErrors()) {
                graphResult.problems.forEach { log.warn("Graph problem: ${it.message}") }
            }

            val graph = graphResult.get() ?: run {
                log.warn("Failed to build project graph - falling back to non-cached execution")
                return
            }
            cachedProjectGraph = graph

            session.projects = graph.sortedProjects
            session.allProjects = graph.allProjects
            session.projectDependencyGraph = graph

            BuildStateManager.applyBuildStates(graph.allProjects)
            log.debug("Graph cache initialized with ${graph.allProjects.size} projects")
        } finally {
            sessionScope.exit()
        }
    }

    private fun ensureSystemProperties(request: MavenExecutionRequest) {
        if (request.systemProperties == null || request.systemProperties.isEmpty()) {
            request.systemProperties = java.util.Properties()
        }
        System.getProperties().forEach { key, value ->
            if (request.systemProperties.getProperty(key.toString()) == null) {
                request.systemProperties.setProperty(key.toString(), value.toString())
            }
        }
    }

    override fun execute(request: MavenExecutionRequest): MavenExecutionResult {
        request.executionListener = BatchExecutionListener()

        return if (cachedProjectGraph != null) {
            executeWithCachedGraph(request)
        } else {
            super.execute(request)
        }
    }

    private fun executeWithCachedGraph(request: MavenExecutionRequest): MavenExecutionResult {
        val result = DefaultMavenExecutionResult()
        sessionScope.enter()

        try {
            val session = MavenSession(container, cachedRepositorySession!!, request, result)
            applyGraphToSession(session, cachedProjectGraph!!, request)

            sessionScope.seed(MavenSession::class.java, session)
            legacySupport.session = session

            eventCatapult.fire(ExecutionEvent.Type.ProjectDiscoveryStarted, session, null)
            result.topologicallySortedProjects = session.projects
            result.project = session.topLevelProject

            lifecycleStarter.execute(session)

            if (!result.hasExceptions()) {
                session.projects?.forEach { project ->
                    try { BuildStateManager.recordBuildState(project) }
                    catch (_: Exception) { }
                }
            }
            return result
        } catch (e: Exception) {
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
        session.allProjects = graph.allProjects
        session.projectDependencyGraph = graph

        val selectedProjects = if (request.selectedProjects.isNotEmpty()) {
            graph.allProjects.filter { project ->
                request.selectedProjects.any { selector ->
                    "${project.groupId}:${project.artifactId}" == selector ||
                    project.artifactId == selector
                }
            }
        } else {
            graph.allProjects.filter { it.file?.absolutePath == request.pom?.absolutePath }
                .ifEmpty { graph.sortedProjects ?: emptyList() }
        }

        session.projects = selectedProjects
        session.currentProject = selectedProjects.firstOrNull()
        session.projectMap = buildProjectMap(selectedProjects)
        BuildStateManager.applyBuildStates(selectedProjects)
    }

    private fun buildProjectMap(projects: List<MavenProject>): Map<String, MavenProject> {
        return projects.associateBy { "${it.groupId}:${it.artifactId}:${it.version}" }
    }

    fun recordBuildStates(projectSelectors: Set<String>) {
        val graph = cachedProjectGraph ?: return

        projectSelectors.forEach { selector ->
            graph.allProjects.find { "${it.groupId}:${it.artifactId}" == selector }
                ?.let { project ->
                    try { BuildStateManager.recordBuildState(project) }
                    catch (_: Exception) { }
                }
        }
    }
}
