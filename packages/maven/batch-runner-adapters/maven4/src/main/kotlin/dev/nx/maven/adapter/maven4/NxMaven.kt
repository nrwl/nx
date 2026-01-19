package dev.nx.maven.adapter.maven4

import org.apache.maven.DefaultMaven
import org.apache.maven.api.Session
import org.apache.maven.api.SessionData
import org.apache.maven.api.services.Lookup
import org.apache.maven.api.services.ModelBuilder
import org.apache.maven.execution.*
import org.apache.maven.graph.GraphBuilder
import org.apache.maven.impl.InternalSession
import org.apache.maven.internal.impl.DefaultSessionFactory
import org.apache.maven.internal.impl.InternalMavenSession
import org.apache.maven.jline.JLineMessageBuilderFactory
import org.apache.maven.lifecycle.internal.ExecutionEventCatapult
import org.apache.maven.lifecycle.internal.LifecycleStarter
import org.apache.maven.model.superpom.SuperPomProvider
import org.apache.maven.plugin.LegacySupport
import org.apache.maven.project.MavenProject
import org.apache.maven.resolver.MavenChainedWorkspaceReader
import org.apache.maven.resolver.RepositorySystemSessionFactory
import org.apache.maven.session.scope.internal.SessionScope
import org.eclipse.aether.RepositorySystemSession
import org.eclipse.aether.repository.WorkspaceReader
import org.slf4j.LoggerFactory
import java.util.concurrent.atomic.AtomicInteger

/**
 * Nx Maven service that extends DefaultMaven and preserves session state across invocations.
 *
 * By extending DefaultMaven and reusing the same instance across batch invocations,
 * the internal MavenSession is preserved, ensuring:
 * - Compiled artifacts from previous goals are visible to subsequent goals
 * - Project model state and cache are preserved
 * - Build session context and properties persist
 *
 * This allows sequential goals (jar:jar → install:install) to see each other's artifacts.
 */
class NxMaven(
  private val lookup: Lookup,
  private val eventCatapult: ExecutionEventCatapult,
  private val legacySupport: LegacySupport,
  private val sessionScope: SessionScope,
  private val repositorySessionFactory: RepositorySystemSessionFactory,
  private val graphBuilder: GraphBuilder,
  buildResumptionAnalyzer: BuildResumptionAnalyzer,
  buildResumptionDataRepository: BuildResumptionDataRepository,
  superPomProvider: SuperPomProvider,
  private val defaultSessionFactory: DefaultSessionFactory,
  private val ideWorkspaceReader: WorkspaceReader?
) : DefaultMaven(
  lookup,
  eventCatapult,
  legacySupport,
  sessionScope,
  repositorySessionFactory,
  graphBuilder,
  buildResumptionAnalyzer,
  buildResumptionDataRepository,
  superPomProvider,
  defaultSessionFactory,
  ideWorkspaceReader
) {
  private val log = LoggerFactory.getLogger(NxMaven::class.java)
  private val executionCount = AtomicInteger(0)

  @Volatile
  private var cachedProjectGraph: ProjectDependencyGraph? = null  // ProjectDependencyGraph

  @Volatile
  private var cachedRepositorySession: RepositorySystemSession? = null

  @Volatile
  private var cachedInternalSession: InternalSession? = null

  @Volatile
  private var cachedWorkspaceReader: MavenChainedWorkspaceReader? = null

  private val getProjectMapMethod by lazy {
    DefaultMaven::class.java.getDeclaredMethod(
      "getProjectMap",
      Collection::class.java
    ).apply { isAccessible = true }
  }

  init {
    log.debug("NxMaven initialized - will use lifecycleStarter with cached graph")
    // Initialize BuildStateManager with Maven's lookup container
    BuildStateManager.initialize(lookup)
  }

  /**
   * Initialize ModelBuilderSession in the session data.
   * This is required for Maven plugins (like install:install) that need to build consumer POMs.
   * Without this, plugins get null mbSession and fail with NPE.
   */
  private fun initializeModelBuilderSession(session: MavenSession) {
    try {
      val modelBuilder = lookup.lookup(ModelBuilder::class.java)
      val mbSession = modelBuilder.newSession()
      val internalSession = InternalSession.from(session.session)
      internalSession
        .getData()
        .set(
          SessionData.key(ModelBuilder.ModelBuilderSession::class.java),
          mbSession
        )
    } catch (e: Exception) {
      log.warn("   ⚠️ Failed to initialize ModelBuilderSession: ${e.message}", e)
    }
  }

  /**
   * Set up the project dependency graph cache using the first real Maven request.
   * This should be called by the invoker after NxMaven is created but before any execute() calls.
   * Using the real request ensures we have proper configuration (pom, baseDirectory, etc).
   */
  @Synchronized
  fun setupGraphCache(request: MavenExecutionRequest) {
    if (cachedProjectGraph != null) {
      log.debug("Graph cache already setup - skipping rebuild and build state application")
      return
    }

    log.debug("🏗️ Setting up project graph cache...")
    val setupStartTime = System.currentTimeMillis()
    request.isRecursive = true

    val workspaceReader = MavenChainedWorkspaceReader(request.workspaceReader, ideWorkspaceReader)
    cachedWorkspaceReader = workspaceReader  // Store reference for later updates
    val closeableSession = repositorySessionFactory
      .newRepositorySessionBuilder(request)
      .setWorkspaceReader(workspaceReader)
      .build()
    val graphSession = MavenSession(closeableSession, request, DefaultMavenExecutionResult())

    // Cache the repository session and maven session for reuse across invocations
    // This preserves artifact cache, repository metadata, and model builder cache
    cachedRepositorySession = closeableSession
    cachedInternalSession = defaultSessionFactory.newSession(graphSession)
    graphSession.session = cachedInternalSession

    sessionScope.enter()
    try {
      sessionScope.seed(MavenSession::class.java, graphSession)
      sessionScope.seed(Session::class.java, graphSession.session)
      sessionScope.seed(
        InternalMavenSession::class.java,
        InternalMavenSession.from(graphSession.session)
      )

      val graphBuildStartTime = System.currentTimeMillis()
      val graphResult = graphBuilder.build(graphSession)
      val graphBuildTimeMs = System.currentTimeMillis() - graphBuildStartTime
      log.debug("   ✅ Graph build completed in ${graphBuildTimeMs}ms")

      if (graphResult.hasErrors()) {
        log.warn("   ⚠️ Graph build had errors, but continuing anyway")
      }

      val graph = graphResult.get()
      cachedProjectGraph = graph

      log.debug("   ✅ Graph cache setup complete with ${graph.allProjects.size} projects")
      graph.sortedProjects?.forEach { project ->
        log.debug("      - ${project.groupId}:${project.artifactId}")
      }

      // Apply existing build states to all projects in the graph
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

  private fun applyGraphToSession(
    session: MavenSession,
    graph: ProjectDependencyGraph,
    request: MavenExecutionRequest
  ) {
    log.debug("Applying project dependency graph to session for ${request.pom}: ${request.goals}")
    session.allProjects = graph.allProjects
    session.projectDependencyGraph = graph

    // Find the selected project(s) to build
    val selectedProjects = session.allProjects.filter {
      "${it.groupId}:${it.artifactId}" == request.selectedProjects.firstOrNull()
    }

    // session.projects controls what lifecycleStarter builds - keep it to selected projects only
    session.projects = selectedProjects
    session.currentProject = selectedProjects.firstOrNull()

    // Project map should match session.projects for consistency
    session.projectMap = getProjectMapMethod.invoke(this, selectedProjects) as Map<String?, MavenProject?>?
  }

  override fun execute(request: MavenExecutionRequest): MavenExecutionResult {
    val count = executionCount.incrementAndGet()
    val invokeStartTime = System.currentTimeMillis()

    // Attach execution listener to track mojo and session events
    request.executionListener = BatchExecutionListener(JLineMessageBuilderFactory())

    // Use doExecute() with our cached session
    val result = executeWithCachedGraph(request)
    val invokeTimeMs = System.currentTimeMillis() - invokeStartTime
    log.debug("NxMaven.execute() invocation #$count completed in ${invokeTimeMs}ms")
    return result
  }

  /**
   * Executes the build using our cached graph and session.
   * This is a streamlined version of DefaultMaven.doExecute() that skips redundant graph building.
   *
   * We reuse:
   * - Cached RepositorySystemSession (holds artifact cache and metadata)
   * - Cached ProjectDependencyGraph (avoids rebuilding the project graph)
   * - Cached InternalSession (preserves ModelBuilderSession)
   *
   * We still run:
   * - ReactorReader setup (for artifact resolution)
   * - ProjectDiscoveryStarted event
   * - lifecycleStarter.execute() (the actual build)
   */
  private fun executeWithCachedGraph(request: MavenExecutionRequest): MavenExecutionResult {
    val result = DefaultMavenExecutionResult()
    sessionScope.enter()

    try {
      // Reuse the cached RepositorySystemSession (holds artifact cache and metadata)
      // Create a new MavenSession wrapper with the new request/result but same cached repository session
      val session = MavenSession(cachedRepositorySession!!, request, result)
      session.session = cachedInternalSession  // Reuse cached InternalSession object to preserve ModelBuilderSession

      initializeModelBuilderSession(session)
      applyGraphToSession(session, cachedProjectGraph!!, request)

      // Re-seed the cached session into the current scope context for this invocation
      reseedSessionInScope(session)

      // Prime ReactorReader's cache with all projects for dependency resolution
      // ReactorReader lazily caches session.getProjects(), so we temporarily set it to all projects
      val selectedProjects = session.projects  // Save selected project(s)
      session.projects = session.allProjects   // Temporarily set to all projects

      // Lookup ReactorReader - it will be created with access to our session (it's @SessionScoped)
      val reactorReader = lookup.lookup(WorkspaceReader::class.java, "reactor")

      // Update the CACHED workspace reader to include this ReactorReader
      // This is the same workspace reader that's in cachedRepositorySession, so artifact resolution will find it
      val readers = LinkedHashSet<WorkspaceReader>()
      readers.add(reactorReader)
      request.workspaceReader?.let { readers.add(it) }
      ideWorkspaceReader?.let { readers.add(it) }
      cachedWorkspaceReader!!.setReaders(readers)

      // Debug: verify workspace reader is properly connected
      log.debug("Workspace reader debug:")
      log.debug("  - cachedWorkspaceReader identity: ${System.identityHashCode(cachedWorkspaceReader)}")
      log.debug("  - cachedRepositorySession.workspaceReader identity: ${System.identityHashCode(cachedRepositorySession!!.workspaceReader)}")
      log.debug("  - Same object: ${cachedWorkspaceReader === cachedRepositorySession!!.workspaceReader}")
      log.debug("  - Readers in cachedWorkspaceReader: ${cachedWorkspaceReader!!.readers.map { it.javaClass.simpleName }}")

      // Force ReactorReader to initialize its projects cache NOW while session.projects has all projects
      // findVersions triggers the lazy initialization of the internal projects map
      try {
        val dummyArtifact = org.eclipse.aether.artifact.DefaultArtifact("__nx__:__prime__:1.0")
        reactorReader.findVersions(dummyArtifact)
        log.debug("ReactorReader cache primed with ${session.allProjects?.size} projects")
      } catch (e: Exception) {
        log.debug("ReactorReader cache priming completed (exception ignored): ${e.message}")
      }

      // Reset session.projects back to selected projects for lifecycle execution
      session.projects = selectedProjects

      // Fire project discovery event (some plugins listen for this)
      eventCatapult.fire(ExecutionEvent.Type.ProjectDiscoveryStarted, session, null)

      // Set result properties
      result.topologicallySortedProjects = session.projects
      result.project = session.topLevelProject

      // Execute the lifecycle - this is the main build work
      val lifecycleStarter = lookup.lookupOptional(LifecycleStarter::class.java, request.builderId)
        .orElseGet { lookup.lookup(LifecycleStarter::class.java) }

      lifecycleStarter.execute(session)

      // Log exceptions with stack traces
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
      sessionScope.exit()
    }
  }

  /**
   * Re-seeds the cached session into the current scope context.
   * Must be called after sessionScope.enter() so the session is available for this invocation.
   * The same session object is reused across all invocations - we just need to make it
   * available in the current scope context for Maven components that request it via DI.
   */
  private fun reseedSessionInScope(session: MavenSession) {
    sessionScope.seed(MavenSession::class.java, session)
    sessionScope.seed(Session::class.java, session.session)
    sessionScope.seed(
      InternalMavenSession::class.java,
      InternalMavenSession.from(session.session)
    )

    legacySupport.session = session
  }

  /**
   * Record build states for the specified projects.
   * Each project selector should be in the format "groupId:artifactId".
   *
   * @param projectSelectors Set of project selectors to record build states for
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
      // Find matching project in the cached graph
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
