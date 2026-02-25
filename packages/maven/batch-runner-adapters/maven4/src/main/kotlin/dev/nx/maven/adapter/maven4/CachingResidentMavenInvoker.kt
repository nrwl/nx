package dev.nx.maven.adapter.maven4

import org.apache.maven.api.services.Lookup
import org.apache.maven.cling.invoker.LookupContext
import org.apache.maven.cling.invoker.mvn.MavenContext
import org.apache.maven.cling.invoker.mvn.resident.ResidentMavenInvoker
import org.apache.maven.execution.MavenExecutionRequest
import org.slf4j.LoggerFactory
import java.util.function.Consumer

/**
 * Custom ResidentMavenInvoker subclass that injects NxMaven to preserve session state across invocations.
 *
 * Key insight: By injecting the same NxMaven instance into every context,
 * NxMaven preserves its internal MavenSession across multiple goals.
 * This allows artifacts from jar:jar to be seen by install:install.
 */
class CachingResidentMavenInvoker(
  protoLookup: Lookup,
  contextConsumer: Consumer<LookupContext>?
) : ResidentMavenInvoker(protoLookup, contextConsumer) {
  private val log = LoggerFactory.getLogger(CachingResidentMavenInvoker::class.java)

  // Single NxMaven instance reused across all invocations - preserves session state
  private var nxMaven: NxMaven? = null

  override fun lookup(context: MavenContext) {
    super.lookup(context)
    context.maven = createNxMavenIfNeeded(context)
  }

  override fun doExecute(context: MavenContext, request: MavenExecutionRequest): Int {
    (context.maven as NxMaven).setupGraphCache(request)
    return super.doExecute(context, request)
  }

  /**
   * Create NxMaven after the first successful execution when the Maven context is fully initialized.
   * This is called from ResidentMavenExecutor after exitCode == 0 on first invocation.
   * Synchronized to prevent race condition where multiple threads create separate instances.
   */
  @Synchronized
  fun createNxMavenIfNeeded(context: MavenContext): NxMaven {
    if (nxMaven != null) {
      return nxMaven!!
    }

    log.debug("Creating NxMaven...")
    nxMaven = NxMavenFactory(context.lookup).create()
    log.debug("NxMaven created and cached")

    return nxMaven!!
  }

  /**
   * Get the NxMaven instance if it has been created.
   * Returns null if NxMaven has not been initialized yet.
   */
  fun getNxMaven(): NxMaven? = nxMaven
}
