package dev.nx.gradle.utils

import dev.nx.gradle.data.NxTargets
import dev.nx.gradle.data.TargetGroups
import java.io.File
import org.gradle.api.Task
import org.gradle.api.file.FileCollection

const val testCiTargetGroup = "verification"

private val testFileNameRegex =
    Regex("^(?!(abstract|fake)).*?(Test)(s)?\\d*", RegexOption.IGNORE_CASE)

private val packageDeclarationRegex =
    Regex(
        """^\s*package\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)""",
        RegexOption.MULTILINE)
private val classDeclarationRegex =
    Regex(
        """^\s*(?:@[\w]+\s*)*(?:public|protected|internal|open|sealed|final|data|enum|annotation)?\s*(class)\s+([A-Za-z_][A-Za-z0-9_]*)""")
private val privateClassRegex = Regex("""\bprivate\s+class\s+([A-Za-z_][A-Za-z0-9_]*)""")

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
        val classNames = getAllVisibleClassesWithNestedAnnotation(testFile)

        classNames?.entries?.forEach { (className, testClassPackagePath) ->
          val targetName = "$ciTestTargetName--$className"
          targets[targetName] =
              buildTestCiTarget(
                  projectBuildPath, testClassPackagePath, testTask, projectRoot, workspaceRoot)
          targetGroups[testCiTargetGroup]?.add(targetName)

          ciDependsOn.add(
              mapOf("target" to targetName, "projects" to "self", "params" to "forward"))
        }
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

// This function return all class names and nested class names inside a file
fun getAllVisibleClassesWithNestedAnnotation(file: File): MutableMap<String, String>? {
  val content = file.takeIf { it.exists() }?.readText() ?: return null

  val lines = content.lines()
  val result = mutableMapOf<String, String>()
  var packageName: String?
  val classStack = mutableListOf<Pair<String, Int>>() // (className, indent)

  var previousLine: String? = null

  for (i in lines.indices) {
    val line = lines[i]
    val trimmed = line.trimStart()
    val indent = line.indexOfFirst { !it.isWhitespace() }.takeIf { it >= 0 } ?: 0

    // Skip private classes
    if (privateClassRegex.containsMatchIn(trimmed)) continue

    packageName = packageDeclarationRegex.find(content)?.groupValues?.getOrNull(1)
    val match = classDeclarationRegex.find(trimmed)
    if (match == null) {
      previousLine = trimmed
      continue
    }

    val className = match.groupValues.getOrNull(2)
    if (className == null) {
      previousLine = trimmed
      continue
    }
    val isAnnotatedNested = previousLine?.trimStart()?.startsWith("@Nested") == true

    // Top-level class (no indentation or same as outermost level)
    if (indent == 0) {
      // Exclude top-level @nested classes
      if (!isAnnotatedNested) {
        result.put(className, packageName?.let { "$it.$className" } ?: className)
      }
      classStack.clear()
      classStack.add(className to indent)
    } else {
      // Maintain nesting stack
      while (classStack.isNotEmpty() && indent <= classStack.last().second) {
        classStack.removeLast()
      }

      val parent = classStack.lastOrNull()?.first
      if (isAnnotatedNested && parent != null) {
        val packageClassName = "$parent$$className"
        result["$parent$className"] =
            packageName?.let { "$it.$packageClassName" } ?: packageClassName
        result.remove(parent) // remove the parent class since child nested class is added
      }

      classStack.add(className to indent)
    }

    previousLine = trimmed
  }

  return result
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
    testClassPackagePath: String,
    testTask: Task,
    projectRoot: String,
    workspaceRoot: String,
): MutableMap<String, Any?> {
  val dependsOnTasks = getDependsOnTask(testTask)
  val taskInputs = getInputsForTask(dependsOnTasks, testTask, projectRoot, workspaceRoot)

  val target =
      mutableMapOf<String, Any?>(
          "executor" to "@nx/gradle:gradle",
          "options" to
              mapOf(
                  "taskName" to "${projectBuildPath}:${testTask.name}",
                  "testClassName" to testClassPackagePath),
          "metadata" to
              getMetadata("Runs Gradle test $testClassPackagePath in CI", projectBuildPath, "test"),
          "cache" to true,
          "inputs" to taskInputs)

  getDependsOnForTask(dependsOnTasks, testTask)
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
