package dev.nx.gradle.cli

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dev.nx.gradle.data.GradleTask
import dev.nx.gradle.data.NxBatchOptions

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

  val excludeTasks =
      argMap["--excludeTasks"]?.split(",")?.map { it.trim() }?.filter { it.isNotEmpty() }
          ?: emptyList()

  val excludeTestTasks =
      argMap["--excludeTestTasks"]?.split(",")?.map { it.trim() }?.filter { it.isNotEmpty() }
          ?: emptyList()

  return NxBatchOptions(
      workspaceRoot = argMap["--workspaceRoot"] ?: "",
      tasks = tasksMap,
      args = argMap["--args"] ?: "",
      quiet = argMap["--quiet"]?.toBoolean() ?: false,
      excludeTasks = excludeTasks,
      excludeTestTasks = excludeTestTasks)
}
