package dev.nx.gradle.utils

import dev.nx.gradle.data.NxTargets
import dev.nx.gradle.data.TargetGroups
import java.io.File
import org.gradle.api.Task
import org.gradle.api.file.FileCollection

const val testCiTargetGroup = "verification"

private val testFileNameRegex =
    Regex("^(?!(abstract|fake)).*?(Test)(s)?\\d*", RegexOption.IGNORE_CASE)

private val classDeclarationRegex = Regex("""(?<!private\s)class\s+([A-Za-z_][A-Za-z0-9_]*)""")

// Essential annotations (most common subset)
private val essentialTestAnnotations =
    setOf(
        "@Test",
        "@TestTemplate",
        "@ParameterizedTest",
        "@RepeatedTest",
        "@TestFactory",
        "@org.junit.Test", // JUnit 4
        "@org.testng.annotations.Test" // TestNG
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
        val className = getTestClassNameIfAnnotated(testFile) ?: return@forEach

        val targetName = "$ciTestTargetName--$className"
        targets[targetName] =
            buildTestCiTarget(
                projectBuildPath, className, testFile, testTask, projectRoot, workspaceRoot)
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

private fun containsEssentialTestAnnotations(content: String): Boolean {
  return essentialTestAnnotations.any { content.contains(it) }
}

private fun getTestClassNameIfAnnotated(file: File): String? {
  val content = file.takeIf { it.exists() }?.readText() ?: return null

  // Only process files that contain test annotations
  if (!containsEssentialTestAnnotations(content)) {
    return null
  }

  // Find all non-private class declarations
  val classMatches = classDeclarationRegex.findAll(content).toList()

  // First, try to find a class that ends with "Test" or "Tests"
  for (match in classMatches) {
    val className = match.groupValues.getOrNull(1) ?: continue
    if ((className.endsWith("Test") || className.endsWith("Tests")) &&
        !className.startsWith("Fake") &&
        !className.startsWith("Abstract")) {
      return className
    }
  }

  // Fallback: find the first non-private class that's not Fake or Abstract
  for (match in classMatches) {
    val className = match.groupValues.getOrNull(1) ?: continue
    if (!className.startsWith("Fake") && !className.startsWith("Abstract")) {
      return className
    }
  }

  return null
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
    testFile: File,
    testTask: Task,
    projectRoot: String,
    workspaceRoot: String,
): MutableMap<String, Any?> {
  val taskInputs = getInputsForTask(testTask, projectRoot, workspaceRoot, null)

  val target =
      mutableMapOf<String, Any?>(
          "executor" to "@nx/gradle:gradle",
          "options" to
              mapOf(
                  "taskName" to "${projectBuildPath}:${testTask.name}",
                  "testClassName" to testClassName),
          "metadata" to
              getMetadata("Runs Gradle test $testClassName in CI", projectBuildPath, "test"),
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
