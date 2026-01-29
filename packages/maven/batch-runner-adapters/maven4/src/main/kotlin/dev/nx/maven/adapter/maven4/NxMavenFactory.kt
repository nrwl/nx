package dev.nx.maven.adapter.maven4

import org.apache.maven.api.services.Lookup
import org.apache.maven.execution.BuildResumptionAnalyzer
import org.apache.maven.execution.BuildResumptionDataRepository
import org.apache.maven.graph.GraphBuilder
import org.apache.maven.internal.impl.DefaultSessionFactory
import org.apache.maven.lifecycle.internal.ExecutionEventCatapult
import org.apache.maven.model.superpom.SuperPomProvider
import org.apache.maven.plugin.LegacySupport
import org.apache.maven.resolver.RepositorySystemSessionFactory
import org.apache.maven.session.scope.internal.SessionScope
import org.eclipse.aether.repository.WorkspaceReader
import org.slf4j.LoggerFactory

/**
 * Factory for creating NxMaven instances with all dependencies resolved from a Lookup.
 *
 * Encapsulates all dependency resolution logic, reducing boilerplate in callers.
 * Simply pass a Lookup and call create() to get a fully configured NxMaven instance.
 */
class NxMavenFactory(private val lookup: Lookup) {
  private val log = LoggerFactory.getLogger(NxMavenFactory::class.java)

  /**
   * Create an NxMaven instance by resolving all dependencies from the lookup.
   *
   * @return Configured NxMaven instance ready for use
   * @throws RuntimeException if required dependencies cannot be resolved
   */
  fun create(): NxMaven {
    log.debug("Creating NxMaven via factory...")

    // Resolve all required dependencies from the lookup
    val eventCatapult = lookup.lookup(ExecutionEventCatapult::class.java)
      ?: throw RuntimeException("ExecutionEventCatapult not available in lookup")
    val legacySupport = lookup.lookup(LegacySupport::class.java)
      ?: throw RuntimeException("LegacySupport not available in lookup")
    val sessionScope = lookup.lookup(SessionScope::class.java)
      ?: throw RuntimeException("SessionScope not available in lookup")
    val repositorySessionFactory = lookup.lookup(RepositorySystemSessionFactory::class.java)
      ?: throw RuntimeException("RepositorySystemSessionFactory not available in lookup")
    val graphBuilder = lookup.lookup(GraphBuilder::class.java)
      ?: throw RuntimeException("GraphBuilder not available in lookup")
    val buildResumptionAnalyzer = lookup.lookup(BuildResumptionAnalyzer::class.java)
      ?: throw RuntimeException("BuildResumptionAnalyzer not available in lookup")
    val buildResumptionDataRepository = lookup.lookup(BuildResumptionDataRepository::class.java)
      ?: throw RuntimeException("BuildResumptionDataRepository not available in lookup")
    val superPomProvider = lookup.lookup(SuperPomProvider::class.java)
      ?: throw RuntimeException("SuperPomProvider not available in lookup")
    val defaultSessionFactory = lookup.lookup(DefaultSessionFactory::class.java)
      ?: throw RuntimeException("DefaultSessionFactory not available in lookup")

    // Optional dependency - workspace reader might not be available
    val ideWorkspaceReader = try {
      lookup.lookup(WorkspaceReader::class.java)
    } catch (e: Exception) {
      log.debug("IDE workspace reader not available: ${e.message}")
      null
    }

    log.debug("All dependencies resolved, creating NxMaven instance")

    return NxMaven(
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
    )
  }
}
