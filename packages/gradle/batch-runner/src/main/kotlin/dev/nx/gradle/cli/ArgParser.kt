package dev.nx.gradle.cli

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.NxBatchOptions
import dev.nx.gradle.util.logger

fun parseArgs(args: Array<String>): NxBatchOptions {
  val argMap = mutableMapOf<String, String>()

  args.forEach {
    when {
      it.startsWith("--") && it.contains("=") -> {
        val (key, value) = it.split("=", limit = 2)
        argMap[key] = value
      }
      it.startsWith("--") -> {
        argMap[it] = "true"
      }
    }
  }

  val gson = Gson()
  val tasksJson = argMap["--tasks"]
  val tasksMap: Map<String, GradleTask> =
      if (tasksJson != null) {
        val taskType = object : TypeToken<Map<String, GradleTask>>() {}.type
        gson.fromJson(tasksJson, taskType)
      } else emptyMap()

  return NxBatchOptions(
      workspaceRoot = argMap["--workspaceRoot"] ?: "",
      tasks = tasksMap,
      args = argMap["--args"] ?: "",
      quiet = argMap["--quiet"]?.toBoolean() ?: false)
}

fun configureLogger(quiet: Boolean) {
  if (quiet) {
    logger.setLevel(java.util.logging.Level.OFF)
    logger.useParentHandlers = false
    logger.handlers.forEach { it.level = java.util.logging.Level.OFF }
  } else {
    logger.setLevel(java.util.logging.Level.INFO)
  }
}
