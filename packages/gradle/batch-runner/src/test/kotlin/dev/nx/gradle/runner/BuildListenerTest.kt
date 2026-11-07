package dev.nx.gradle.runner

import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.TaskResult
import java.io.ByteArrayOutputStream
import org.gradle.tooling.events.OperationDescriptor
import org.gradle.tooling.events.PluginIdentifier
import org.gradle.tooling.events.ProgressEvent
import org.gradle.tooling.events.task.TaskFinishEvent
import org.gradle.tooling.events.task.TaskOperationDescriptor
import org.gradle.tooling.events.task.TaskOperationResult
import org.gradle.tooling.events.task.TaskSkippedResult
import org.gradle.tooling.events.task.TaskStartEvent
import org.gradle.tooling.events.task.TaskSuccessResult
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class BuildListenerTest {

  private class Descriptor(
      private val path: String,
      private val deps: Set<OperationDescriptor> = emptySet(),
  ) : TaskOperationDescriptor {
    override fun getTaskPath() = path

    override fun getDependencies() = deps

    override fun getOriginPlugin(): PluginIdentifier? = null

    override fun getName() = path

    override fun getDisplayName() = path

    override fun getParent(): OperationDescriptor? = null
  }

  /** Results as Gradle reports them, checked against a real build with the Tooling API. */
  private enum class Outcome {
    /** Ran its actions: not up to date, with a reason. */
    RAN,
    /** A lifecycle task whose dependencies did work: not up to date, but no reasons. */
    NO_ACTIONS,
    UP_TO_DATE,
    FROM_CACHE,
    SKIPPED,
    /** Ran, on a Gradle that does not report execution reasons. */
    RAN_WITHOUT_REASONS,
  }

  private class Success(
      private val start: Long,
      private val end: Long,
      private val upToDate: Boolean,
      private val fromCache: Boolean,
      private val reasons: List<String>?,
  ) : TaskSuccessResult {
    override fun getStartTime() = start

    override fun getEndTime() = end

    override fun isUpToDate() = upToDate

    override fun isFromCache() = fromCache

    override fun isIncremental() = false

    override fun getExecutionReasons() = reasons
  }

  private class Skipped(private val start: Long, private val end: Long) : TaskSkippedResult {
    override fun getStartTime() = start

    override fun getEndTime() = end

    override fun getSkipMessage() = "SKIPPED"
  }

  private class Start(private val descriptor: TaskOperationDescriptor, private val time: Long) :
      TaskStartEvent {
    override fun getEventTime() = time

    override fun getDisplayName() = descriptor.taskPath

    override fun getDescriptor() = descriptor
  }

  private class Finish(
      private val descriptor: TaskOperationDescriptor,
      private val result: TaskOperationResult,
  ) : TaskFinishEvent {
    override fun getEventTime() = result.endTime

    override fun getDisplayName() = descriptor.taskPath

    override fun getDescriptor() = descriptor

    override fun getResult() = result
  }

  private data class Run(
      val descriptor: TaskOperationDescriptor,
      val start: Long,
      val end: Long,
      val outcome: Outcome = Outcome.RAN,
  )

  /** Start and finish events for [runs], in the order Gradle reports them. */
  private fun events(vararg runs: Run): List<ProgressEvent> =
      runs
          .flatMap { run ->
            val result =
                when (run.outcome) {
                  Outcome.RAN ->
                      Success(
                          run.start,
                          run.end,
                          upToDate = false,
                          fromCache = false,
                          reasons =
                              listOf(
                                  "Task has not declared any outputs despite executing actions."))
                  Outcome.NO_ACTIONS ->
                      Success(run.start, run.end, upToDate = false, fromCache = false, emptyList())
                  Outcome.UP_TO_DATE ->
                      Success(run.start, run.end, upToDate = true, fromCache = false, emptyList())
                  Outcome.FROM_CACHE ->
                      Success(run.start, run.end, upToDate = true, fromCache = true, emptyList())
                  Outcome.SKIPPED -> Skipped(run.start, run.end)
                  Outcome.RAN_WITHOUT_REASONS ->
                      Success(run.start, run.end, upToDate = false, fromCache = false, null)
                }
            listOf(Start(run.descriptor, run.start), Finish(run.descriptor, result))
          }
          // A task's finish comes before the start of a task that depends on it, even at the same
          // instant.
          .sortedWith(compareBy({ it.eventTime }, { if (it is TaskFinishEvent) 0 else 1 }))

  private fun resultsFor(
      nxTasks: List<String>,
      events: List<ProgressEvent>,
  ): Map<String, TaskResult> {
    val results = mutableMapOf<String, TaskResult>()
    val listener =
        buildListener(
            nxTasks.associateWith { GradleTask(":$it") },
            mutableMapOf(),
            results,
            mutableMapOf(),
            TaskOutputCapture(ByteArrayOutputStream())) { _, _ ->
            }
    events.forEach(listener)
    return results
  }

  @Test
  fun `lifecycle task covers the dependencies that did work`() {
    val compileKotlin = Descriptor(":app:compileKotlin")
    val compileTestKotlin = Descriptor(":app:compileTestKotlin", setOf(compileKotlin))
    val aggregate = Descriptor(":app:compileForCiTestGroups", setOf(compileTestKotlin))

    val results =
        resultsFor(
            listOf("app:compileForCiTestGroups"),
            events(
                Run(compileKotlin, 7, 238),
                Run(compileTestKotlin, 238, 334),
                Run(aggregate, 334, 334, Outcome.NO_ACTIONS)))

    val result = results.getValue("app:compileForCiTestGroups")
    assertEquals(7L, result.startTime)
    assertEquals(334L, result.endTime)
  }

  @Test
  fun `task that did its own work keeps its own start`() {
    val compileKotlin = Descriptor(":app:compileKotlin")
    val classes = Descriptor(":app:classes", setOf(compileKotlin))
    val jar = Descriptor(":app:jar", setOf(classes))

    val results =
        resultsFor(
            listOf("app:jar"),
            events(
                Run(compileKotlin, 0, 120),
                Run(classes, 120, 120, Outcome.NO_ACTIONS),
                Run(jar, 121, 125)))

    val result = results.getValue("app:jar")
    assertEquals(121L, result.startTime)
    assertEquals(125L, result.endTime)
  }

  @Test
  fun `lifecycle task ignores dependencies that were skipped or up to date`() {
    val disabled = Descriptor(":app:disabled")
    val upToDate = Descriptor(":app:upToDate")
    val ran = Descriptor(":app:ran")
    val aggregate = Descriptor(":app:assemble", setOf(disabled, upToDate, ran))

    val results =
        resultsFor(
            listOf("app:assemble"),
            events(
                Run(disabled, 1, 1, Outcome.SKIPPED),
                Run(upToDate, 2, 3, Outcome.UP_TO_DATE),
                Run(ran, 50, 90),
                Run(aggregate, 90, 90, Outcome.NO_ACTIONS)))

    assertEquals(50L, results.getValue("app:assemble").startTime)
  }

  @Test
  fun `lifecycle task counts dependencies restored from the build cache`() {
    val compileKotlin = Descriptor(":app:compileKotlin")
    val aggregate = Descriptor(":app:classes", setOf(compileKotlin))

    val results =
        resultsFor(
            listOf("app:classes"),
            events(
                Run(compileKotlin, 10, 15, Outcome.FROM_CACHE),
                Run(aggregate, 15, 15, Outcome.NO_ACTIONS)))

    assertEquals(10L, results.getValue("app:classes").startTime)
  }

  @Test
  fun `task restored from the build cache keeps its own start`() {
    val compileKotlin = Descriptor(":app:compileKotlin")
    val jar = Descriptor(":app:jar", setOf(compileKotlin))

    val results =
        resultsFor(
            listOf("app:jar"),
            events(Run(compileKotlin, 0, 120), Run(jar, 121, 122, Outcome.FROM_CACHE)))

    assertEquals(121L, results.getValue("app:jar").startTime)
  }

  @Test
  fun `does not count dependencies that are nx tasks`() {
    val compileKotlin = Descriptor(":app:compileKotlin")
    val classes = Descriptor(":app:classes", setOf(compileKotlin))
    val processResources = Descriptor(":app:processResources")
    val assemble = Descriptor(":app:assemble", setOf(classes, processResources))

    val results =
        resultsFor(
            listOf("app:classes", "app:assemble"),
            events(
                Run(compileKotlin, 10, 50),
                Run(classes, 50, 50, Outcome.NO_ACTIONS),
                Run(processResources, 55, 58),
                Run(assemble, 60, 60, Outcome.NO_ACTIONS)))

    assertEquals(10L, results.getValue("app:classes").startTime)
    assertEquals(55L, results.getValue("app:assemble").startTime)
  }

  @Test
  fun `lifecycle task with no dependency that did work keeps its own start`() {
    val upToDate = Descriptor(":app:compileKotlin")
    val aggregate = Descriptor(":app:classes", setOf(upToDate, Descriptor(":app:notExecuted")))

    val results =
        resultsFor(
            listOf("app:classes"),
            events(
                Run(upToDate, 1, 2, Outcome.UP_TO_DATE),
                Run(aggregate, 42, 42, Outcome.UP_TO_DATE)))

    assertEquals(42L, results.getValue("app:classes").startTime)
  }

  @Test
  fun `task that turned out up to date covers the dependencies that did work`() {
    // The compile reran but produced identical classes, so jar had nothing to do. jar still waited
    // on that compile, so its time covers it.
    val compileKotlin = Descriptor(":app:compileKotlin")
    val jar = Descriptor(":app:jar", setOf(compileKotlin))

    val results =
        resultsFor(
            listOf("app:jar"),
            events(Run(compileKotlin, 0, 120), Run(jar, 121, 121, Outcome.UP_TO_DATE)))

    assertEquals(0L, results.getValue("app:jar").startTime)
  }

  @Test
  fun `task keeps its own start when gradle does not report execution reasons`() {
    val compileKotlin = Descriptor(":app:compileKotlin")
    val classes = Descriptor(":app:classes", setOf(compileKotlin))

    val results =
        resultsFor(
            listOf("app:classes"),
            events(
                Run(compileKotlin, 0, 120, Outcome.RAN_WITHOUT_REASONS),
                Run(classes, 120, 120, Outcome.RAN_WITHOUT_REASONS)))

    assertEquals(120L, results.getValue("app:classes").startTime)
  }
}
