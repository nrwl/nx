package dev.nx.maven.runner

import org.apache.maven.api.services.MessageBuilderFactory
import org.apache.maven.cling.event.ExecutionEventLogger
import org.apache.maven.execution.ExecutionEvent

/**
 * Execution listener for tracking mojo execution times and session lifecycle in batch builds.
 */
class BatchExecutionListener(messageBuilderFactory: MessageBuilderFactory) : ExecutionEventLogger(messageBuilderFactory) {

  override fun projectDiscoveryStarted(event: ExecutionEvent) {
    // No-op so that the Scanning for projects message does not show up since it was cached
  }
}
