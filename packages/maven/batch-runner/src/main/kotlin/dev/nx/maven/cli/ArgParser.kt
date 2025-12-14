package dev.nx.maven.cli

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dev.nx.maven.data.MavenBatchOptions
import dev.nx.maven.data.MavenBatchTask
import dev.nx.maven.data.TaskGraph

object ArgParser {
    private val gson = Gson()

    fun parseArgs(args: Array<String>): MavenBatchOptions {
        var workspaceRoot = ""
        var verbose = false

        var i = 0
        while (i < args.size) {
            when {
                args[i] == "--workspaceRoot" && i + 1 < args.size -> {
                    workspaceRoot = args[++i]
                }
                args[i].startsWith("--workspaceRoot=") -> {
                    workspaceRoot = args[i].substringAfter("=")
                }
                args[i] == "--verbose" -> {
                    verbose = true
                }
            }
            i++
        }

        // Trim quotes from arguments if present
        val cleanWorkspaceRoot = workspaceRoot.trim().trim('"')

        if (cleanWorkspaceRoot.isBlank()) {
            throw IllegalArgumentException("workspaceRoot is required")
        }

        // Read combined payload from stdin (taskGraph, tasks, and args)
        val stdinJson = System.`in`.bufferedReader().readText()

        // Parse the combined payload
        val payload = if (stdinJson.isNotEmpty() && stdinJson != "{}") {
            try {
                val type = object : TypeToken<Map<String, Any>>() {}.type
                gson.fromJson<Map<String, Any>>(stdinJson, type)
            } catch (e: Exception) {
                throw IllegalArgumentException("Failed to parse stdin payload JSON", e)
            }
        } else {
            emptyMap()
        }

        // Extract and parse taskGraph from payload
        val taskGraph = if (payload.containsKey("taskGraph")) {
            try {
                val taskGraphData = payload["taskGraph"] as? Map<String, Any>
                    ?: throw IllegalArgumentException("taskGraph is not a map")
                val taskGraphJson = gson.toJson(taskGraphData)
                gson.fromJson(taskGraphJson, TaskGraph::class.java)
            } catch (e: Exception) {
                throw IllegalArgumentException("Failed to parse taskGraph from payload", e)
            }
        } else {
            null
        }

        // Extract and parse tasks from payload
        val tasksMap = if (payload.containsKey("tasks")) {
            try {
                val rawTasks = payload["tasks"] as? Map<String, Map<String, Any>>
                    ?: throw IllegalArgumentException("tasks is not a map")

                rawTasks.mapValues { (taskId, taskData) ->
                    MavenBatchTask(
                        id = taskId,
                        phase = (taskData["phase"] as? String),
                        goals = (taskData["goals"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                        args = (taskData["args"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                        project = (taskData["project"] as String)
                    )
                }
            } catch (e: Exception) {
                throw IllegalArgumentException("Failed to parse tasks from payload", e)
            }
        } else {
            emptyMap()
        }

        // Extract and parse args from payload
        val argsList = if (payload.containsKey("args")) {
            try {
                payload["args"] as? List<*>
                    ?: throw IllegalArgumentException("args is not a list")
                val argsJson = gson.toJson(payload["args"])
                val type = object : TypeToken<List<String>>() {}.type
                gson.fromJson<List<String>>(argsJson, type)
            } catch (e: Exception) {
                throw IllegalArgumentException("Failed to parse args from payload", e)
            }
        } else {
            emptyList()
        }

        return MavenBatchOptions(
            workspaceRoot = cleanWorkspaceRoot,
            taskOptions = tasksMap,
            args = argsList,
            verbose = verbose,
            taskGraph = taskGraph
        )
    }
}
