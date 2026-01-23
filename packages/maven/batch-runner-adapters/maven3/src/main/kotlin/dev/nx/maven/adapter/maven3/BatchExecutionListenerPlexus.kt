package dev.nx.maven.adapter.maven3

import org.apache.maven.execution.AbstractExecutionListener
import org.apache.maven.execution.ExecutionEvent
import java.io.PrintStream

/**
 * Execution listener that writes directly to an output stream.
 *
 * SLF4J loggers in the ClassRealm don't output to the batch-runner's console,
 * so we bypass logging and write directly to the stream that's passed through
 * the invocation chain.
 */
class BatchExecutionListenerPlexus(private val output: PrintStream) : AbstractExecutionListener() {

    companion object {
        @Volatile
        private var currentProjectId: String? = null
    }

    override fun projectDiscoveryStarted(event: ExecutionEvent) {
        // No-op - suppress "Scanning for projects" since graph is cached
    }

    override fun projectStarted(event: ExecutionEvent) {
        val project = event.project ?: return
        val projectId = "${project.groupId}:${project.artifactId}"
        if (projectId != currentProjectId) {
            currentProjectId = projectId
            output.println("[INFO] ")
            output.println("[INFO] Building ${project.name} ${project.version}")
            output.println("[INFO] ${"-".repeat(70)}")
        }
    }

    override fun mojoStarted(event: ExecutionEvent) {
        val mojo = event.mojoExecution ?: return
        output.println("[INFO] ")
        output.println("[INFO] --- ${mojo.artifactId}:${mojo.version}:${mojo.goal} (${mojo.executionId}) @ ${event.project?.artifactId} ---")
    }

    override fun sessionEnded(event: ExecutionEvent) {
        // No-op - suppress session end messages
    }
}
