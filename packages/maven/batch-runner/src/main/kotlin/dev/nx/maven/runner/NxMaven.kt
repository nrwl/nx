package dev.nx.maven.runner

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
import org.apache.maven.model.superpom.SuperPomProvider
import org.apache.maven.plugin.LegacySupport
import org.apache.maven.project.MavenProject
import org.apache.maven.resolver.MavenChainedWorkspaceReader
import org.apache.maven.resolver.RepositorySystemSessionFactory
import org.apache.maven.session.scope.internal.SessionScope
import org.eclipse.aether.RepositorySystemSession
import org.eclipse.aether.repository.WorkspaceReader
import org.slf4j.LoggerFactory
import java.io.OutputStream
import java.io.PrintStream
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
  eventCatapult: ExecutionEventCatapult,
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

  // Cache the doExecute method so we don't look it up every invocation
  private val doExecuteMethod by lazy {
    DefaultMaven::class.java.getDeclaredMethod(
      "doExecute",
      MavenExecutionRequest::class.java,
      MavenSession::class.java,
      MavenExecutionResult::class.java,
      MavenChainedWorkspaceReader::class.java
    ).apply { isAccessible = true }
  }

  private val getProjectMapMethod by lazy {
    DefaultMaven::class.java.getDeclaredMethod(
      "getProjectMap",
      Collection::class.java
    ).apply { isAccessible = true }
  }

  init {
    log.info("NxMaven initialized - will use doExecute() with managed session")
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
      log.warn("   ⚠️  Failed to initialize ModelBuilderSession: ${e.message}", e)
    }
  }

  /**
   * Set up the project dependency graph cache using the first real Maven request.
   * This should be called by the invoker after NxMaven is created but before any execute() calls.
   * Using the real request ensures we have proper configuration (pom, baseDirectory, etc).
   */
  fun setupGraphCache(request: MavenExecutionRequest) {
    if (cachedProjectGraph != null) {
      log.debug("Graph cache already setup - skipping rebuild and build state application")
      return
    }

    log.debug("🏗️  Setting up project graph cache...")
    val setupStartTime = System.currentTimeMillis()
    request.isRecursive = true

    val workspaceReader = MavenChainedWorkspaceReader(request.workspaceReader, null)
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

      // Temporarily replace System.err during graph building to prevent logging recursion.
      // Maven 4.x redirects System.err to LoggingOutputStream which calls stderr.warn(),
      // which eventually calls MavenBaseLogger.write() -> System.err.println() -> infinite loop.
      // Using a pass-through stream breaks this chain while preserving output.
      val originalErr = System.err
      val graphResult = try {
        System.setErr(PrintStream(object : OutputStream() {
          override fun write(b: Int) = originalErr.write(b)
          override fun write(b: ByteArray, off: Int, len: Int) = originalErr.write(b, off, len)
        }))
        val graphBuildStartTime = System.currentTimeMillis()
        val result = graphBuilder.build(graphSession)
        val graphBuildTimeMs = System.currentTimeMillis() - graphBuildStartTime
        log.debug("   ✅ Graph build completed in ${graphBuildTimeMs}ms")
        result
      } finally {
        System.setErr(originalErr)
      }

      if (graphResult.hasErrors()) {
        log.warn("   ⚠️  Graph build had errors, but continuing anyway")
      }

      val graph = graphResult.get()
      cachedProjectGraph = graph

      // Set allProjects on graphSession BEFORE looking up ReactorReader
      // ReactorReader is @SessionScoped and caches project list from MavenSession.getAllProjects()
      // If we lookup ReactorReader before setting allProjects, it will cache an empty list
      graphSession.allProjects = graph.allProjects

      // NOW add ReactorReader to workspace chain - it will see the projects we just set
      val reactorReader = lookup.lookup(WorkspaceReader::class.java, "reactor")
      workspaceReader.addReader(reactorReader)
      cachedWorkspaceReader = workspaceReader
      log.debug("   ✅ ReactorReader added to cached workspace chain")

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
      log.debug("   ⏱️  Total graph cache setup time: ${totalSetupTimeMs}ms")
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

    val selectedProjects = session.allProjects.filter {
      "${it.groupId}:${it.artifactId}" == request.selectedProjects.firstOrNull()
    }

    session.projects = selectedProjects
    session.currentProject = selectedProjects.firstOrNull()

    session.projectMap = getProjectMapMethod.invoke(this, session.projects) as Map<String?, MavenProject?>?
  }

  override fun execute(request: MavenExecutionRequest): MavenExecutionResult {
    val count = executionCount.incrementAndGet()
    val invokeStartTime = System.currentTimeMillis()

    // Attach execution listener to track mojo and session events
    request.executionListener = BatchExecutionListener(JLineMessageBuilderFactory())

    // Use doExecute() with our cached session
    val result = executeWithCachedGraph(request)
    val invokeTimeMs = System.currentTimeMillis() - invokeStartTime
    log.debug("🏁 NxMaven.execute() invocation #$count completed in ${invokeTimeMs}ms")
    return result
  }

  /**
   * Executes the build using our cached session via reflection-based doExecute() call.
   * Reuses cached RepositorySystemSession and MavenSession to preserve artifact cache,
   * repository metadata cache, and model builder cache across invocations.
   * This ensures we maintain full control over the session lifecycle across all invocations.
   */
  private fun executeWithCachedGraph(request: MavenExecutionRequest): MavenExecutionResult {
    val result = DefaultMavenExecutionResult()
    sessionScope.enter()
    // Reuse the cached workspace reader that has ReactorReader added
    // This is critical for consumer POM building which needs to resolve reactor artifacts
    val workspaceReader = cachedWorkspaceReader!!

    // Reuse the cached RepositorySystemSession (holds artifact cache and metadata)
    // Create a new MavenSession wrapper with the new request/result but same cached repository session
    val session = MavenSession(cachedRepositorySession!!, request, result)
    session.session = cachedInternalSession  // Reuse cached InternalSession object to preserve ModelBuilderSession

    initializeModelBuilderSession(session)

    applyGraphToSession(session, cachedProjectGraph!!, request)

    return try {

      // Re-seed the cached session into the current scope context for this invocation
      reseedSessionInScope(session)


      @Suppress("UNCHECKED_CAST")
      // Use the CACHED request (which is stored in the session) not the new request
      // This ensures doExecute sees consistent session/request state
      val executionResult = doExecuteMethod.invoke(
        this,
        request,
        session,
        result,
        workspaceReader
      ) as MavenExecutionResult

      // Log exceptions with stack traces (Maven's context.options().showErrors() isn't reliable in parallel execution)
      if (executionResult.hasExceptions()) {
        log.error("Build completed with ${executionResult.exceptions.size} exception(s):")
        for (e in executionResult.exceptions) {
          log.error("Exception: ${e.message}", e)
        }
      }

      executionResult
    } catch (e: Exception) {
      log.error("   ❌ Error executing with cached session: ${e.message}", e)
      throw RuntimeException("Failed to execute Maven with cached session", e)
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
    log.debug("🔄 Recording build states for ${projectSelectors.size} projects...")

    var recordedCount = 0
    var failedCount = 0

    projectSelectors.forEach { selector ->
      // Find matching project in the cached graph
      val project = cachedProjectGraph!!.allProjects.find { p ->
        "${p.groupId}:${p.artifactId}" == selector
      }

      if (project != null) {
        val success = BuildStateManager.recordBuildState(project)
        if (success) {
          recordedCount++
        } else {
          failedCount++
        }
      } else {
        log.warn("  ✗ Project not found for selector: $selector")
        failedCount++
      }
    }

    val duration = System.currentTimeMillis() - startTime
    log.debug("✅ Build state recording completed: $recordedCount succeeded, $failedCount failed (took ${duration}ms)")
  }

}
