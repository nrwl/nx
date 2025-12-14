package dev.nx.maven.reflection

import org.apache.maven.Maven
import org.apache.maven.execution.MavenExecutionRequest
import org.apache.maven.execution.MavenExecutionResult
import org.slf4j.LoggerFactory

/**
 * Wrapper for Maven instances that adds caching and batch execution support.
 *
 * Instead of extending DefaultMaven (which couples us to a specific version),
 * this wrapper composes a Maven instance and delegates to it while adding our custom logic.
 *
 * This approach works across Maven 4.x versions because:
 * - Maven interface is stable (just has execute() method)
 * - We get the actual Maven instance from user's installation via Lookup
 * - We only interact with stable public APIs
 */
open class MavenWrapper(
  private val delegateMaven: Maven
) : Maven {
  private val log = LoggerFactory.getLogger(MavenWrapper::class.java)

  override fun execute(request: MavenExecutionRequest): MavenExecutionResult {
    log.debug("MavenWrapper intercepting execute() call")

    // Delegate to the actual Maven instance (from user's installation)
    // Custom caching/batching logic will be added by NxMaven subclass
    return delegateMaven.execute(request)
  }

  /**
   * Get the underlying Maven instance.
   * Useful for accessing implementation-specific features via reflection.
   */
  protected fun getDelegate(): Maven = delegateMaven
}
