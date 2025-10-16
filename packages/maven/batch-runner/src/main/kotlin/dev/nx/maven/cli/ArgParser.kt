package dev.nx.maven.cli

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dev.nx.maven.data.MavenBatchOptions
import dev.nx.maven.data.MavenBatchTask
import java.io.File

object ArgParser {
    private val gson = Gson()

    fun parseArgs(args: Array<String>): MavenBatchOptions {
        var workspaceRoot = ""
        var tasksJson = ""
        var argsJson = "[]"
        var resultsFile = ""
        var quiet = false
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
                args[i] == "--tasks" && i + 1 < args.size -> {
                    tasksJson = args[++i]
                }
                args[i].startsWith("--tasks=") -> {
                    tasksJson = args[i].substringAfter("=")
                }
                args[i] == "--args" && i + 1 < args.size -> {
                    argsJson = args[++i]
                }
                args[i].startsWith("--args=") -> {
                    argsJson = args[i].substringAfter("=")
                }
                args[i] == "--resultsFile" && i + 1 < args.size -> {
                    resultsFile = args[++i]
                }
                args[i].startsWith("--resultsFile=") -> {
                    resultsFile = args[i].substringAfter("=")
                }
                args[i] == "--quiet" -> {
                    quiet = true
                }
                args[i] == "--verbose" -> {
                    verbose = true
                }
            }
            i++
        }

        // Read task graph from stdin
        val taskGraphJson = System.`in`.bufferedReader().readText()

        // Parse tasks JSON
        val tasksMap = if (tasksJson.isNotEmpty()) {
            try {
                val type = object : TypeToken<Map<String, Map<String, Any>>>() {}.type
                val rawTasks: Map<String, Map<String, Any>> = gson.fromJson(tasksJson, type)

                rawTasks.mapValues { (taskId, taskData) ->
                    MavenBatchTask(
                        id = taskId,
                        phase = (taskData["phase"] as? String),
                        goals = (taskData["goals"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                        args = (taskData["args"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
                        project = (taskData["project"] as? String)
                    )
                }
            } catch (e: Exception) {
                throw IllegalArgumentException("Failed to parse tasks JSON: $tasksJson", e)
            }
        } else {
            emptyMap()
        }

        // Parse args JSON
        val argsList = if (argsJson.isNotEmpty() && argsJson != "[]") {
            try {
                val type = object : TypeToken<List<String>>() {}.type
                gson.fromJson<List<String>>(argsJson, type)
            } catch (e: Exception) {
                throw IllegalArgumentException("Failed to parse args JSON: $argsJson", e)
            }
        } else {
            emptyList()
        }

        // Trim quotes from arguments if present
        val cleanWorkspaceRoot = workspaceRoot.trim().trim('"')
        val cleanResultsFile = resultsFile.trim().trim('"')

        if (cleanWorkspaceRoot.isBlank()) {
            throw IllegalArgumentException("workspaceRoot is required")
        }

        return MavenBatchOptions(
            workspaceRoot = cleanWorkspaceRoot,
            tasks = tasksMap,
            args = argsList,
            resultsFile = cleanResultsFile,
            quiet = quiet,
            verbose = verbose,
            taskGraph = taskGraphJson
        )
    }
}
