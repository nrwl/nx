package dev.nx.gradle.utils

import dev.nx.gradle.data.NxTargets
import dev.nx.gradle.data.TargetGroups
import java.io.File
import org.gradle.api.Task
import org.gradle.api.file.FileCollection

const val testCiTargetGroup = "verification"

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
    ciTestTargetName: String,
    compileTest: Boolean = false
) {
  ensureTargetGroupExists(targetGroups, testCiTargetGroup)

  val ciDependsOn = mutableListOf<Map<String, String>>()

  if (compileTest) {
    val testClassNames = getCompiledTestClassNames(testTask, projectBuildPath)
    processTestClasses(
        testClassNames,
        ciTestTargetName,
        projectBuildPath,
        testTask,
        projectRoot,
        workspaceRoot,
        targets,
        targetGroups,
        ciDependsOn)
  } else {
    testFiles
        .filter { it.path.startsWith(workspaceRoot) }
        .forEach { testFile ->
          // Check if file contains test annotations before processing
          val content = testFile.takeIf { it.exists() }?.readText()
          if (content != null && containsEssentialTestAnnotations(content)) {
            val classNames = getAllVisibleClassesWithNestedAnnotation(testFile)
            classNames?.let {
              processTestClasses(
                  it,
                  ciTestTargetName,
                  projectBuildPath,
                  testTask,
                  projectRoot,
                  workspaceRoot,
                  targets,
                  targetGroups,
                  ciDependsOn)
            }
          }
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

internal fun processTestClasses(
    testClassNames: Map<String, String>,
    ciTestTargetName: String,
    projectBuildPath: String,
    testTask: Task,
    projectRoot: String,
    workspaceRoot: String,
    targets: NxTargets,
    targetGroups: TargetGroups,
    ciDependsOn: MutableList<Map<String, String>>
) {
  testClassNames.forEach { (className, testClassPackagePath) ->
    val targetName = "$ciTestTargetName--$className"
    targets[targetName] =
        buildTestCiTarget(
            projectBuildPath, testClassPackagePath, testTask, projectRoot, workspaceRoot)
    targetGroups[testCiTargetGroup]?.add(targetName)

    ciDependsOn.add(mapOf("target" to targetName, "projects" to "self", "params" to "forward"))
  }
}

private fun getCompiledTestClassNames(
    testTask: Task,
    projectBuildPath: String
): Map<String, String> {
  val result = mutableMapOf<String, String>()
  val project = testTask.project

  try {
    // Execute compileTestKotlin and compileTestJava tasks
    val compileTestKotlinTask = project.tasks.findByName("compileTestKotlin")
    val compileTestJavaTask = project.tasks.findByName("compileTestJava")

    compileTestKotlinTask?.let { task ->
      testTask.logger.info("Executing compileTestKotlin task")
      task.actions.forEach { action -> action.execute(task) }
    }

    compileTestJavaTask?.let { task ->
      testTask.logger.info("Executing compileTestJava task")
      task.actions.forEach { action -> action.execute(task) }
    }

    // Find and analyze test classes directories
    val testClassesDirs = getTestClassesDirs(project)

    testClassesDirs.forEach { testClassesDir ->
      if (testClassesDir.exists() && testClassesDir.isDirectory) {
        testTask.logger.info("Analyzing test classes directory: ${testClassesDir.absolutePath}")
        analyzeTestClassesDir(testClassesDir, "", result, testTask)
      }
    }
  } catch (e: Exception) {
    testTask.logger.warn("Error getting compiled test class names: ${e.message}")
    testTask.logger.debug("Stack trace:", e)
  }

  return result
}

internal fun getTestClassesDirs(project: org.gradle.api.Project): List<File> {
  val testClassesDirs = mutableListOf<File>()

  // Standard Gradle test classes directories
  val buildDir = project.layout.buildDirectory.asFile.get()
  val kotlinTestClasses = File(buildDir, "classes/kotlin/test")
  val javaTestClasses = File(buildDir, "classes/java/test")

  if (kotlinTestClasses.exists()) {
    testClassesDirs.add(kotlinTestClasses)
  }

  if (javaTestClasses.exists()) {
    testClassesDirs.add(javaTestClasses)
  }

  return testClassesDirs
}

internal fun analyzeTestClassesDir(
    dir: File,
    packagePath: String,
    result: MutableMap<String, String>,
    testTask: Task
) {
  dir.listFiles()?.forEach { file ->
    when {
      file.isDirectory -> {
        val newPackagePath = if (packagePath.isEmpty()) file.name else "$packagePath.${file.name}"
        analyzeTestClassesDir(file, newPackagePath, result, testTask)
      }
      file.name.endsWith(".class") -> {
        val className = file.name.removeSuffix(".class")
        if (isTestClass(file, testTask)) {
          val fullClassName = if (packagePath.isEmpty()) className else "$packagePath.$className"
          result[className] = fullClassName
          testTask.logger.info("Found test class: $fullClassName")
        }
      }
    }
  }
}

internal fun isTestClass(classFile: File, testTask: Task): Boolean {
  return try {
    // Simple heuristic: check if class file contains test-related bytecode patterns
    // This is a simplified approach - in practice, you'd want to use a bytecode analysis library
    val className = classFile.name.removeSuffix(".class")

    // Common test class naming patterns
    val isTestByName =
        className.endsWith("Test") ||
            className.endsWith("Tests") ||
            className.startsWith("Test") ||
            className.contains("Test")

    if (isTestByName) {
      testTask.logger.debug("Class $className identified as test class by naming pattern")
      return true
    }

    // For now, return false for non-pattern matches
    // In a full implementation, you'd analyze the bytecode for test annotations
    false
  } catch (e: Exception) {
    testTask.logger.debug("Error analyzing class file ${classFile.name}: ${e.message}")
    false
  }
}

private fun containsEssentialTestAnnotations(content: String): Boolean {
  return essentialTestAnnotations.any { content.contains(it) }
}

// This function returns all class names and nested class names inside a file
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

private fun buildTestCiTarget(
    projectBuildPath: String,
    testClassPackagePath: String,
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
                  "testClassName" to testClassPackagePath),
          "metadata" to
              getMetadata("Runs Gradle test $testClassPackagePath in CI", projectBuildPath, "test"),
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
