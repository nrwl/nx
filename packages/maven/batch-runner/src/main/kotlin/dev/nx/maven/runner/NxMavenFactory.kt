package dev.nx.maven.runner

import org.apache.maven.Maven
import org.apache.maven.api.services.Lookup
import org.apache.maven.internal.impl.DefaultSessionFactory
import org.apache.maven.graph.GraphBuilder
import org.apache.maven.lifecycle.internal.ExecutionEventCatapult
import org.apache.maven.plugin.LegacySupport
import org.apache.maven.resolver.RepositorySystemSessionFactory
import org.apache.maven.session.scope.internal.SessionScope
import org.eclipse.aether.repository.WorkspaceReader
import org.slf4j.LoggerFactory

/**
 * Factory for creating NxMaven instances with all dependencies resolved from a Lookup.
 *
 * Instead of creating DefaultMaven directly (which would couple us to a specific version),
 * we get the Maven instance from the user's installation via Lookup.
 *
 * This approach works across Maven 4.x versions because:
 * - Maven instance comes from user's installation (any version)
 * - We only interact with stable public APIs
 * - Dependencies are resolved via DI (version-agnostic)
 */
class NxMavenFactory(private val lookup: Lookup) {
  private val log = LoggerFactory.getLogger(NxMavenFactory::class.java)

  /**
   * Create an NxMaven instance by resolving all dependencies from the lookup.
   *
   * Gets the Maven instance from user's installation via Lookup, then wraps it
   * with NxMaven to add caching and batch execution support.
   *
   * @return Configured NxMaven instance ready for use
   * @throws RuntimeException if required dependencies cannot be resolved
   */
  fun create(): NxMaven {
    log.debug("Creating NxMaven via factory...")

    // Get Maven instance from user's installation
    // This is the actual DefaultMaven (or compatible implementation) from their Maven version
    val maven = lookup.lookup(Maven::class.java)
      ?: throw RuntimeException("Maven not available in lookup - ensure Maven 4.x is properly installed")

    log.debug("Resolved Maven instance: ${maven.javaClass.name}")

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

    // DefaultSessionFactory is only available in Maven 4.x
    val defaultSessionFactory = try {
      lookup.lookup(DefaultSessionFactory::class.java)
    } catch (e: Exception) {
      log.debug("DefaultSessionFactory not available (Maven 3.x)")
      null
    }

    // Optional dependency - workspace reader might not be available
    val ideWorkspaceReader = try {
      lookup.lookup(WorkspaceReader::class.java)
    } catch (e: Exception) {
      log.debug("IDE workspace reader not available: ${e.message}")
      null
    }

    log.debug("All dependencies resolved, creating NxMaven wrapper")

    return NxMaven(
      maven,
      lookup,
      eventCatapult,
      legacySupport,
      sessionScope,
      repositorySessionFactory,
      graphBuilder,
      defaultSessionFactory,
      ideWorkspaceReader
    )
  }
}
