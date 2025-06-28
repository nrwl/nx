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
    ciTestTargetName: String
) {
  testTask.logger.info("${testTask.path}: Starting addTestCiTargets")

  ensureTargetGroupExists(targetGroups, testCiTargetGroup)

  val ciDependsOn = mutableListOf<Map<String, String>>()

  // Always try to use compiled class analysis first
  testTask.logger.info("${testTask.path}: Getting compiled test class names")
  val testClassNames =
      try {
        getCompiledTestClassNames(testTask)
      } catch (e: Exception) {
        testTask.logger.warn(
            "${testTask.path}: Error getting compiled test class names: ${e.message}")
        emptyMap<String, String>()
      }

  testTask.logger.info("${testTask.path}: Found ${testClassNames.size} compiled test classes")

  if (testClassNames.isNotEmpty()) {
    // Use compiled class analysis if classes are available
    testTask.logger.info(
        "${testTask.path}: Processing ${testClassNames.size} compiled test classes")
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
    testTask.logger.info("${testTask.path}: Finished processing compiled test classes")
  } else {
    // Fall back to regex-based source analysis if compiled classes not available
    testTask.logger.info(
        "${testTask.path}: No compiled test classes found, falling back to regex analysis")
    processTestFilesWithRegex(
        testFiles,
        workspaceRoot,
        ciTestTargetName,
        projectBuildPath,
        testTask,
        projectRoot,
        targets,
        targetGroups,
        ciDependsOn)
    testTask.logger.info("${testTask.path}: Finished regex-based test file processing")
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

private fun processTestFilesWithRegex(
    testFiles: FileCollection,
    workspaceRoot: String,
    ciTestTargetName: String,
    projectBuildPath: String,
    testTask: Task,
    projectRoot: String,
    targets: NxTargets,
    targetGroups: TargetGroups,
    ciDependsOn: MutableList<Map<String, String>>
) {
  testFiles
      .filter { it.path.startsWith(workspaceRoot) }
      .forEach { testFile ->
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

internal fun getCompiledTestClassNames(
    testTask: Task
): Map<String, String> {
  val result = mutableMapOf<String, String>()
  val project = testTask.project

  try {
    // Use Gradle's built-in testClassesDirs from Test tasks
    val testClassesDirs = if (testTask is org.gradle.api.tasks.testing.Test) {
      testTask.testClassesDirs.files.toList()
    } else {
      // Fallback: look for Test tasks in the project
      project.tasks.withType(org.gradle.api.tasks.testing.Test::class.java)
        .flatMap { it.testClassesDirs.files }
        .distinct()
    }

    if (testClassesDirs.isEmpty() || testClassesDirs.none { it.exists() }) {
      testTask.logger.info("No test classes directories found or they don't exist")
      return result
    }

    testClassesDirs.forEach { testClassesDir ->
      if (testClassesDir.exists() && testClassesDir.isDirectory) {
        testTask.logger.info("Analyzing test classes directory: ${testClassesDir.absolutePath}")
        analyzeTestClassesDir(testClassesDir, "", result, testTask)
        testTask.logger.info(
            "Finished analyzing ${testClassesDir.absolutePath}, found ${result.size} test classes so far")
      }
    }
  } catch (e: Exception) {
    testTask.logger.warn("Error getting compiled test class names: ${e.message}")
    testTask.logger.debug("Stack trace:", e)
  }

  testTask.logger.info("Total compiled test classes found: ${result.size}")
  return result
}


internal fun analyzeTestClassesDir(
    dir: File,
    packagePath: String,
    result: MutableMap<String, String>,
    testTask: Task,
    visitedDirs: MutableSet<String> = mutableSetOf(),
    maxDepth: Int = 20,
    currentDepth: Int = 0
) {
  // Prevent infinite recursion due to symlinks or circular references
  val canonicalPath =
      try {
        dir.canonicalPath
      } catch (e: Exception) {
        testTask.logger.warn("Unable to get canonical path for $dir: ${e.message}")
        return
      }

  if (canonicalPath in visitedDirs || currentDepth >= maxDepth) {
    testTask.logger.debug(
        "Skipping directory $canonicalPath (already visited or max depth reached)")
    return
  }

  visitedDirs.add(canonicalPath)

  dir.listFiles()?.forEach { file ->
    when {
      file.isDirectory -> {
        val newPackagePath = if (packagePath.isEmpty()) file.name else "$packagePath.${file.name}"
        analyzeTestClassesDir(
            file, newPackagePath, result, testTask, visitedDirs, maxDepth, currentDepth + 1)
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
    val className = classFile.name.removeSuffix(".class")
    
    // Filter out invalid class names but allow nested classes for now
    if (className.contains(" ") || className.isBlank()) {
      testTask.logger.debug("Skipping class with invalid name: $className")
      return false
    }
    
    // For classes with $, filter out anonymous/lambda classes but allow named nested classes
    if (className.contains("$")) {
      // Anonymous classes have numeric suffixes: MyClass$1, MyClass$2
      // Lambda classes: MyClass$$Lambda$1
      val afterDollar = className.substringAfterLast("$")
      val lambdaPattern = "$" + "$" + "Lambda" + "$"
      val isAnonymousOrLambda = afterDollar.all { it.isDigit() } || 
                               className.contains(lambdaPattern) ||
                               afterDollar.startsWith("WhenMappings") // Kotlin when mappings
      
      if (isAnonymousOrLambda) {
        testTask.logger.debug("Skipping anonymous/lambda class: $className")
        return false
      }
    }
    
    // Try bytecode analysis first
    if (classFile.length() > 0) {
      try {
        val bytes = classFile.readBytes()
        val bytecodeString = String(bytes, Charsets.ISO_8859_1)
        
        // Check for @Nested classes first (these can have $ in name)
        val isNestedTestClass = bytecodeString.contains("Lorg/junit/jupiter/api/Nested;")
        if (isNestedTestClass) {
          testTask.logger.debug("Class $className identified as nested test class")
          return true
        }
        
        // Look for test annotations in the bytecode
        val hasTestAnnotations = listOf(
            "Lorg/junit/Test;",           // JUnit 4 @Test
            "Lorg/junit/jupiter/api/Test;", // JUnit 5 @Test
            "Lorg/testng/annotations/Test;", // TestNG @Test
            "Lkotlin/test/Test;",          // Kotlin test @Test
            "TestTemplate",               // JUnit 5 @TestTemplate
            "ParameterizedTest",          // JUnit 5 @ParameterizedTest
            "RepeatedTest"                // JUnit 5 @RepeatedTest
        ).any { annotation ->
          bytecodeString.contains(annotation)
        }
        
        if (hasTestAnnotations) {
          testTask.logger.debug("Class $className identified as test class by bytecode analysis")
          return true
        }
      } catch (e: Exception) {
        testTask.logger.debug("Bytecode analysis failed for ${classFile.name}: ${e.message}, falling back to naming patterns")
      }
    }
    
    // Fallback to naming patterns for test scenarios or when bytecode analysis fails
    val isTestByName = className.endsWith("Test") ||
                      className.endsWith("Tests") ||
                      className.startsWith("Test") ||
                      className.contains("Test")
    
    if (isTestByName) {
      testTask.logger.debug("Class $className identified as test class by naming pattern (fallback)")
      return true
    }
    
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
