package dev.nx.maven.adapter.maven4

import org.apache.maven.api.services.MessageBuilderFactory
import org.apache.maven.cling.event.ExecutionEventLogger
import org.apache.maven.execution.ExecutionEvent

/**
 * Execution listener for tracking mojo execution times and session lifecycle in batch builds.
 * Suppresses verbose Maven output since the batch runner provides its own summary.
 */
class BatchExecutionListener(messageBuilderFactory: MessageBuilderFactory) : ExecutionEventLogger(messageBuilderFactory) {

  companion object {
    // Track current project across invocations to avoid duplicate "Building" headers
    @Volatile
    private var currentProjectId: String? = null
  }

  override fun projectDiscoveryStarted(event: ExecutionEvent) {
    // No-op so that the Scanning for projects message does not show up since it was cached
  }

  override fun projectStarted(event: ExecutionEvent) {
    // Only print "Building" header if project has changed
    val projectId = "${event.project?.groupId}:${event.project?.artifactId}"
    if (projectId != currentProjectId) {
      currentProjectId = projectId
      super.projectStarted(event)
    }
  }

  override fun sessionEnded(event: ExecutionEvent) {
    // No-op - suppress "Total time" and other session end messages
    // The batch runner provides its own summary with timing for all tasks
  }
}
