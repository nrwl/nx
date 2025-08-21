package dev.nx.gradle.utils

import dev.nx.gradle.data.NxTargets
import dev.nx.gradle.data.TargetGroups
import dev.nx.gradle.utils.parsing.containsEssentialTestAnnotations
import dev.nx.gradle.utils.parsing.getAllVisibleClassesWithNestedAnnotation
import java.io.File
import org.gradle.api.Task
import org.gradle.api.file.FileCollection

const val testCiTargetGroup = "verification"

fun addTestCiTargets(
    testFiles: FileCollection,
    projectBuildPath: String,
    testTask: Task,
    targets: NxTargets,
    targetGroups: TargetGroups,
    projectRoot: String,
    workspaceRoot: String,
    ciTestTargetName: String
) {
  ensureTargetGroupExists(targetGroups, testCiTargetGroup)

  val ciDependsOn = mutableListOf<Map<String, String>>()

  processTestFiles(
      testFiles,
      projectBuildPath,
      testTask,
      targets,
      targetGroups,
      projectRoot,
      workspaceRoot,
      ciTestTargetName,
      ciDependsOn)

  ensureParentCiTarget(
      targets,
      targetGroups,
      ciTestTargetName,
      projectBuildPath,
      testTask,
      projectRoot,
      workspaceRoot,
      ciDependsOn)
}

private fun processTestFiles(
    testFiles: FileCollection,
    projectBuildPath: String,
    testTask: Task,
    targets: NxTargets,
    targetGroups: TargetGroups,
    projectRoot: String,
    workspaceRoot: String,
    ciTestTargetName: String,
    ciDependsOn: MutableList<Map<String, String>>
) {
  testFiles
      .filter { isTestFile(it, workspaceRoot) }
      .forEach { testFile ->
        val classNames = getAllVisibleClassesWithNestedAnnotation(testFile, testTask)

        classNames?.forEach { (className, testClassPackagePath) ->
          val targetName = "$ciTestTargetName--$className"
          targets[targetName] =
              buildTestCiTarget(
                  projectBuildPath, testClassPackagePath, testTask, projectRoot, workspaceRoot)
          targetGroups[testCiTargetGroup]?.add(targetName)

          ciDependsOn.add(
              mapOf("target" to targetName, "projects" to "self", "params" to "forward"))
        }
      }
}

private fun isTestFile(file: File, workspaceRoot: String): Boolean {
  val content = file.takeIf { it.exists() }?.readText()
  return content != null && containsEssentialTestAnnotations(content)
  // Additional check for test files that might not have obvious annotations
  // Could be extended with more sophisticated logic
}

fun ensureTargetGroupExists(targetGroups: TargetGroups, group: String) {
  targetGroups.getOrPut(group) { mutableListOf() }
}

private fun buildTestCiTarget(
    projectBuildPath: String,
    testClassPackagePath: String,
    testTask: Task,
    projectRoot: String,
    workspaceRoot: String,
): MutableMap<String, Any?> {
  val taskInputs = getInputsForTask(null, testTask, projectRoot, workspaceRoot)

  val target =
      mutableMapOf<String, Any?>(
          "executor" to "@nx/gradle:gradle",
          "options" to
              mapOf(
                  "taskName" to "${projectBuildPath}:${testTask.name}",
                  "testClassName" to testClassPackagePath),
          "metadata" to
              getMetadata("Runs Gradle test $testClassPackagePath in CI", projectBuildPath, testTask.name),
          "cache" to true,
          "inputs" to taskInputs)

  getOutputsForTask(testTask, projectRoot, workspaceRoot)
      ?.takeIf { it.isNotEmpty() }
      ?.let {
        testTask.logger.info("${testTask.path}: found ${it.size} outputs entries")
        target["outputs"] = it
      }

  return target
}

private fun ensureParentCiTarget(
    targets: NxTargets,
    targetGroups: TargetGroups,
    ciTestTargetName: String,
    projectBuildPath: String,
    testTask: Task,
    projectRoot: String,
    workspaceRoot: String,
    ciDependsOn: List<Map<String, String>>
) {
  if (ciDependsOn.isNotEmpty()) {
    val taskInputs = getInputsForTask(null, testTask, projectRoot, workspaceRoot)

    targets[ciTestTargetName] =
        mutableMapOf<String, Any?>(
            "executor" to "nx:noop",
            "metadata" to getMetadata("Runs all Gradle tests in CI", projectBuildPath, testTask.name),
            "cache" to true,
            "inputs" to taskInputs,
            "dependsOn" to ciDependsOn)

    targetGroups[testCiTargetGroup]?.add(ciTestTargetName)

    getOutputsForTask(testTask, projectRoot, workspaceRoot)
        ?.takeIf { it.isNotEmpty() }
        ?.let {
          testTask.logger.info("${testTask.path}: found ${it.size} outputs entries")
          (targets[ciTestTargetName] as MutableMap<String, Any?>)["outputs"] = it
        }
  }
}
