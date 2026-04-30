package dev.nx.gradle.runner

object OutputProcessor {
  private val GRADLE_TASK_PATH = Regex(""":[a-zA-Z][\w\-]*(?::[a-zA-Z][\w\-]*)+""")

  /**
   * Strips trailing lines that reference a Gradle task path other than [currentTaskPath]. Gradle
   * prints scheduling preamble for the next task before its `> Task :…` header arrives in the
   * stream, so header-position attribution leaks those lines into the previous section; this
   * removes them. Stops when a line either references [currentTaskPath] or has no task-path
   * reference at all.
   */
  internal fun stripNextTaskPreamble(captured: String, currentTaskPath: String): String {
    if (captured.isEmpty()) return captured
    val lines = captured.split('\n').toMutableList()
    while (lines.isNotEmpty()) {
      val last = lines.last()
      if (last.isBlank()) {
        lines.removeAt(lines.lastIndex)
        continue
      }
      val refs = GRADLE_TASK_PATH.findAll(last).map { it.value }.toList()
      if (refs.isEmpty()) break
      if (refs.any { it == currentTaskPath }) break
      lines.removeAt(lines.lastIndex)
    }
    return lines.joinToString("\n")
  }
}
