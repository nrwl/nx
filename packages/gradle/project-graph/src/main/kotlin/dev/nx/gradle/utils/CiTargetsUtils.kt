package dev.nx.gradle.utils

import dev.nx.gradle.data.*
import java.io.File
import org.gradle.api.Task
import org.gradle.api.file.FileCollection

const val testCiTargetGroup = "verification"

/**
 * Add atomized ci test targets Going to loop through each test files and create a target for each
 * It is going to modify targets and targetGroups in place
 */
fun addTestCiTargets(
    testFiles: FileCollection,
    projectBuildPath: String,
    testTask: Task,
    targets: NxTargets,
    targetGroups: TargetGroups,
    projectRoot: String,
    workspaceRoot: String,
    ciTargetName: String
) {
  ensureTargetGroupExists(targetGroups, testCiTargetGroup)

  val gradlewCommand = getGradlewCommand()
  val ciDependsOn = mutableListOf<Map<String, String>>()

  val filteredTestFiles = testFiles.filter { isTestFile(it, workspaceRoot) }

  filteredTestFiles.forEach { testFile ->
    val className = getTestClassNameIfAnnotated(testFile) ?: return@forEach

    val testCiTarget =
        buildTestCiTarget(
            gradlewCommand = gradlewCommand,
            projectBuildPath = projectBuildPath,
            testClassName = className,
            testFile = testFile,
            testTask = testTask,
            projectRoot = projectRoot,
            workspaceRoot = workspaceRoot)

    val targetName = "$ciTargetName--$className"
    targets[targetName] = testCiTarget
    targetGroups[testCiTargetGroup]?.add(targetName)

    ciDependsOn.add(mapOf("target" to targetName, "projects" to "self", "params" to "forward"))
  }

  testTask.logger.info("$testTask ci tasks: $ciDependsOn")

  if (ciDependsOn.isNotEmpty()) {
    ensureParentCiTarget(
        targets = targets,
        targetGroups = targetGroups,
        ciTargetName = ciTargetName,
        projectBuildPath = projectBuildPath,
        dependsOn = ciDependsOn)
  }
}

private fun getTestClassNameIfAnnotated(file: File): String? {
  if (!file.exists()) return null

  val content = file.readText()
  if (!content.contains("@Test")) return null

  val classRegex = Regex("""class\s+([A-Za-z_][A-Za-z0-9_]*)""")
  val match = classRegex.find(content)
  return match?.groupValues?.get(1)
}

fun ensureTargetGroupExists(targetGroups: TargetGroups, group: String) {
  if (!targetGroups.containsKey(group)) {
    targetGroups[group] = mutableListOf()
  }
}

private fun isTestFile(file: File, workspaceRoot: String): Boolean {
  val fileName = file.name.substringBefore(".")
  val regex = "^(?!abstract).*?(Test)(s)?\\d*".toRegex(RegexOption.IGNORE_CASE)
  return file.path.startsWith(workspaceRoot) && regex.matches(fileName)
}

private fun buildTestCiTarget(
    gradlewCommand: String,
    projectBuildPath: String,
    testClassName: String,
    testFile: File,
    testTask: Task,
    projectRoot: String,
    workspaceRoot: String
): MutableMap<String, Any?> {
  val target =
      mutableMapOf<String, Any?>(
          "command" to "$gradlewCommand ${projectBuildPath}:test --tests $testClassName",
          "metadata" to
              getMetadata("Runs Gradle test $testClassName in CI", projectBuildPath, "test"),
          "cache" to true,
          "inputs" to arrayOf(replaceRootInPath(testFile.path, projectRoot, workspaceRoot)))

  getDependsOnForTask(testTask, null)
      ?.takeIf { it.isNotEmpty() }
      ?.let {
        testTask.logger.info("$testTask: processed ${it.size} dependsOn")
        target["dependsOn"] = it
      }

  getOutputsForTask(testTask, projectRoot, workspaceRoot)
      ?.takeIf { it.isNotEmpty() }
      ?.let {
        testTask.logger.info("$testTask: processed ${it.size} outputs")
        target["outputs"] = it
      }

  return target
}

private fun ensureParentCiTarget(
    targets: NxTargets,
    targetGroups: TargetGroups,
    ciTargetName: String,
    projectBuildPath: String,
    dependsOn: List<Map<String, String>>
) {
  val ciTarget =
      targets.getOrPut(ciTargetName) {
        mutableMapOf<String, Any?>().apply {
          put("executor", "nx:noop")
          put("metadata", getMetadata("Runs Gradle Tests in CI", projectBuildPath, "test", "test"))
          put("dependsOn", mutableListOf<Map<String, String>>())
          put("cache", true)
        }
      }

  val dependsOnList = ciTarget.getOrPut("dependsOn") { mutableListOf<Any?>() } as MutableList<Any?>
  dependsOnList.addAll(dependsOn)

  if (targetGroups[testCiTargetGroup]?.contains(ciTargetName) != true) {
    targetGroups[testCiTargetGroup]?.add(ciTargetName)
  }
}
