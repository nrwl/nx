package dev.nx.gradle.utils

import dev.nx.gradle.data.NxTargets
import dev.nx.gradle.data.TargetGroups
import java.io.File
import org.gradle.api.Task
import org.gradle.api.file.FileCollection

const val testCiTargetGroup = "verification"

private val testFileNameRegex =
    Regex("^(?!(abstract|fake)).*?(Test)(s)?\\d*", RegexOption.IGNORE_CASE)

private val classDeclarationRegex = Regex("""class\s+([A-Za-z_][A-Za-z0-9_]*)""")
private val packageDeclarationRegex =
    Regex("""package\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)""")

private data class TestClassInfo(
    val className: String,
    val packageName: String,
    val fullQualifiedName: String
)

fun addTestCiTargets(
    testFiles: FileCollection,
    projectBuildPath: String,
    testTask: Task,
    testTargetName: String,
    targets: NxTargets,
    targetGroups: TargetGroups,
    projectRoot: String,
    workspaceRoot: String,
    ciTestTargetName: String
) {
  ensureTargetGroupExists(targetGroups, testCiTargetGroup)

  val ciDependsOn = mutableListOf<Map<String, String>>()

  testFiles
      .filter { isTestFile(it, workspaceRoot) }
      .forEach { testFile ->
        val testClassInfo = getTestClassInfoIfAnnotated(testFile) ?: return@forEach

        val targetName = "$ciTestTargetName--${testClassInfo.className}"
        targets[targetName] =
            buildTestCiTarget(
                projectBuildPath,
                testClassInfo.fullQualifiedName,
                testTask,
                projectRoot,
                workspaceRoot)
        targetGroups[testCiTargetGroup]?.add(targetName)

        ciDependsOn.add(mapOf("target" to targetName, "projects" to "self", "params" to "forward"))
      }

  testTask.logger.info("${testTask.path} generated CI targets: ${ciDependsOn.map { it["target"] }}")

  if (ciDependsOn.isNotEmpty()) {
    ensureParentCiTarget(
        targets,
        targetGroups,
        ciTestTargetName,
        projectBuildPath,
        testTask,
        testTargetName,
        ciDependsOn)
  }
}

private fun getTestClassInfoIfAnnotated(file: File): TestClassInfo? {
  return file
      .takeIf { it.exists() }
      ?.readText()
      ?.takeIf {
        it.contains("@Test") || it.contains("@TestTemplate") || it.contains("@ParameterizedTest")
      }
      ?.let { content ->
        val className = classDeclarationRegex.find(content)?.groupValues?.getOrNull(1)
        val packageName = packageDeclarationRegex.find(content)?.groupValues?.getOrNull(1)

        return if (className != null && !className.startsWith("Fake")) {
          val fullQualifiedName =
              if (packageName != null) {
                "$packageName.$className"
              } else {
                className
              }
          TestClassInfo(className, packageName ?: "", fullQualifiedName)
        } else {
          null
        }
      }
}

fun ensureTargetGroupExists(targetGroups: TargetGroups, group: String) {
  targetGroups.getOrPut(group) { mutableListOf() }
}

private fun isTestFile(file: File, workspaceRoot: String): Boolean {
  val fileName = file.name.substringBefore(".")
  return file.path.startsWith(workspaceRoot) && testFileNameRegex.matches(fileName)
}

private fun buildTestCiTarget(
    projectBuildPath: String,
    testClassName: String,
    testTask: Task,
    projectRoot: String,
    workspaceRoot: String,
): MutableMap<String, Any?> {
  val taskInputs = getInputsForTask(testTask, projectRoot, workspaceRoot, null)

  val target =
      mutableMapOf<String, Any?>(
          "executor" to "@nx/gradle:gradle",
          "options" to
              mapOf("taskName" to "${projectBuildPath}:${testTask.name}", "testClassName" to testClassName),
          "metadata" to getMetadata("Runs Gradle test $testClassName in CI", projectBuildPath, "test"),
          "cache" to true,
          "inputs" to taskInputs)

  getDependsOnForTask(testTask, null)
      ?.takeIf { it.isNotEmpty() }
      ?.let {
        testTask.logger.info("${testTask.path}: found ${it.size} dependsOn entries")
        target["dependsOn"] = it
      }

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
    testTargetName: String,
    dependsOn: List<Map<String, String>>
) {
  val ciTarget =
      targets.getOrPut(ciTestTargetName) {
        mutableMapOf<String, Any?>(
            "executor" to "nx:noop",
            "metadata" to
                getMetadata(
                    "Runs Gradle ${testTask.name} in CI",
                    projectBuildPath,
                    testTask.name,
                    testTargetName),
            "dependsOn" to mutableListOf<Any?>(),
            "cache" to true)
      }

  @Suppress("UNCHECKED_CAST")
  val dependsOnList = ciTarget["dependsOn"] as? MutableList<Any?> ?: mutableListOf()
  dependsOnList.addAll(dependsOn)

  if (!targetGroups[testCiTargetGroup].orEmpty().contains(ciTestTargetName)) {
    targetGroups[testCiTargetGroup]?.add(ciTestTargetName)
  }
}
