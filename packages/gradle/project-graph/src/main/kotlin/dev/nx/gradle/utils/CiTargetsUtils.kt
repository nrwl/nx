package dev.nx.gradle.utils

import dev.nx.gradle.data.NxTargets
import dev.nx.gradle.data.TargetGroups
import java.io.File
import org.gradle.api.Task
import org.gradle.api.file.FileCollection
import org.junit.platform.engine.discovery.DiscoverySelectors
import org.junit.platform.launcher.LauncherDiscoveryRequest
import org.junit.platform.launcher.core.LauncherDiscoveryRequestBuilder
import org.junit.platform.launcher.core.LauncherFactory

const val testCiTargetGroup = "verification"

// Global JUnit launcher instance - created once and reused for all test discovery
private val junitLauncher = LauncherFactory.create()

// Class-level test annotation names (without @ prefix for AST parsing)
private val classTestAnnotationNames =
    setOf(
        "Nested",
        "TestInstance",
        "TestMethodOrder",
        "DisplayName",
        "ExtendWith",
        "TestPropertySource",
        "AssertFileChannelDataBlocksClosed")

// Method-level test annotation names (without @ prefix for AST parsing)
private val methodTestAnnotationNames =
    setOf(
        "Test",
        "TestTemplate",
        "ParameterizedTest",
        "RepeatedTest",
        "TestFactory",
        "BeforeEach",
        "AfterEach",
        "BeforeAll",
        "AfterAll")

// Class-level qualified annotation names
private val classQualifiedTestAnnotations =
    setOf(
        "org.junit.jupiter.api.Nested",
        "org.junit.jupiter.api.TestInstance",
        "org.junit.jupiter.api.TestMethodOrder",
        "org.junit.jupiter.api.DisplayName",
        "org.junit.jupiter.api.extension.ExtendWith",
        "org.springframework.test.context.TestPropertySource",
        "org.springframework.boot.loader.testsupport.AssertFileChannelDataBlocksClosed")

// Method-level qualified annotation names
private val methodQualifiedTestAnnotations =
    setOf(
        "org.junit.Test",
        "org.junit.jupiter.api.Test",
        "org.junit.jupiter.api.TestTemplate",
        "org.junit.jupiter.api.ParameterizedTest",
        "org.junit.jupiter.api.RepeatedTest",
        "org.junit.jupiter.api.TestFactory",
        "org.junit.jupiter.api.BeforeEach",
        "org.junit.jupiter.api.AfterEach",
        "org.junit.jupiter.api.BeforeAll",
        "org.junit.jupiter.api.AfterAll",
        "org.testng.annotations.Test",
        "kotlin.test.Test")

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

  // Validate testFiles collection and log missing directories
  val allFiles = testFiles.files
  val existingFiles = allFiles.filter { it.exists() }
  val missingFiles = allFiles.filter { !it.exists() }

  if (missingFiles.isNotEmpty()) {
    testTask.logger.info("${testTask.path}: Skipping ${missingFiles.size} non-existent test files")
    missingFiles.forEach { file ->
      testTask.logger.debug("${testTask.path}: Missing test file: ${file.absolutePath}")
    }
  }

  if (existingFiles.isEmpty()) {
    testTask.logger.info("${testTask.path}: No test files found, skipping CI target generation")
    return
  }

  testTask.logger.info("${testTask.path}: Processing ${existingFiles.size} existing test files")

  ensureTargetGroupExists(targetGroups, testCiTargetGroup)

  val ciDependsOn = mutableListOf<Map<String, String>>()

  testTask.logger.info("${testTask.path}: Processing test files with JUnit discovery")
  processTestFiles(
      existingFiles,
      workspaceRoot,
      ciTestTargetName,
      projectBuildPath,
      testTask,
      projectRoot,
      targets,
      targetGroups,
      ciDependsOn)
  testTask.logger.info("${testTask.path}: Finished test file processing")

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

private fun processTestFiles(
    testFiles: List<File>,
    workspaceRoot: String,
    ciTestTargetName: String,
    projectBuildPath: String,
    testTask: Task,
    projectRoot: String,
    targets: NxTargets,
    targetGroups: TargetGroups,
    ciDependsOn: MutableList<Map<String, String>>
) {
  // Try to get test class directories from the test task if it's a Test task
  val testClassDirs =
      if (testTask is org.gradle.api.tasks.testing.Test) {
        val testClassesDirs = testTask.testClassesDirs
        if (testClassesDirs != null) {
          testClassesDirs.files.filter { it.exists() }
        } else {
          emptyList()
        }
      } else {
        // Fallback: look for compiled test classes in standard locations
        val buildDir = testTask.project.layout.buildDirectory.get().asFile
        val testClassDirs =
            listOf(File(buildDir, "classes/java/test"), File(buildDir, "classes/kotlin/test"))
                .filter { it.exists() }
        testClassDirs
      }

  val testClassNames = mutableMapOf<String, String>()

  // First, try runtime class inspection if compiled classes are available
  if (testClassDirs.isNotEmpty()) {
    testTask.logger.info(
        "${testTask.path}: Using Gradle test discovery with ${testClassDirs.size} class directories")

    testClassDirs.forEach { classDir ->
      testTask.logger.info("${testTask.path}: Class directory: ${classDir.absolutePath}")
    }

    // Create a class loader for the test classes
    val testClassLoader = createTestClassLoader(testTask, testTask.logger)

    testClassDirs.forEach { classDir ->
      discoverTestClasses(classDir, testClassLoader, testClassNames, testTask.logger)
    }
  } else { // Fall back to regex parsing if no compiled classes found or no test classes discovered
    testTask.logger.info(
        "${testTask.path}: No compiled test classes found, falling back to regex parsing")

    // Use regex parsing to find test classes in source files
    testFiles.forEach { file ->
      if (file.exists() && (file.extension == "kt" || file.extension == "java")) {
        try {
          val content = file.readText()
          val className = extractClassNameFromFile(content)

          if (className != null && isTestClassByRegex(content)) {
            testClassNames[className] = className
          }
        } catch (e: Exception) {
          testTask.logger.debug("${testTask.path}: Error parsing file ${file.path}: ${e.message}")
        }
      }
    }
  }

  if (testClassNames.isNotEmpty()) {
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
    val builtTarget =
        buildTestCiTarget(
            projectBuildPath, testClassPackagePath, testTask, projectRoot, workspaceRoot)

    // Debug logging before storing
    testTask.logger.info(
        "${testTask.path}: Storing target $targetName with executor: ${builtTarget["executor"]}")

    // Additional validation before storing
    if (builtTarget["executor"] == null || builtTarget["executor"].toString().isEmpty()) {
      testTask.logger.error(
          "${testTask.path}: CRITICAL - Target $targetName has null/empty executor before storage!")
      builtTarget["executor"] = "@nx/gradle:gradle"
    }

    targets[targetName] = builtTarget
    targetGroups[testCiTargetGroup]?.add(targetName)

    // Debug logging after storing
    testTask.logger.info(
        "${testTask.path}: Stored target $targetName, verifying executor: ${targets[targetName]?.get("executor")}")

    ciDependsOn.add(mapOf("target" to targetName, "projects" to "self", "params" to "forward"))
  }
}

// Helper function to extract class name from file
private fun extractClassNameFromFile(content: String): String? {
  // Try to extract class name from the file content
  val classRegex = Regex("class\\s+(\\w+)")
  val match = classRegex.find(content)
  return match?.groupValues?.get(1)
}

// Helper function to check if content contains test methods or annotations
private fun isTestClassByRegex(content: String): Boolean {
  // Parse lines early for reuse
  val lines = content.lines()
  val nonEmptyLines = lines.filter { it.trim().isNotEmpty() }

  // Skip abstract classes as they can't be instantiated
  if (content.contains("abstract class")) {
    return false
  }

  // Skip internal classes - check for internal class declaration
  if (content.contains("internal class")) {
    return false
  }

  // Skip data classes
  if (content.contains("data class")) {
    return false
  }

  // Skip classes that implement interfaces but have no actual test methods
  // This catches test utilities and fakes that implement interfaces
  if (content.contains(": ") && (content.contains("class ") || content.contains("object "))) {
    // Check if this class has actual test methods, not just interface implementations
    val hasTestMethods =
        lines.any { line ->
          val trimmedLine = line.trim()
          !trimmedLine.startsWith("//") &&
              (trimmedLine.contains("@Test") ||
                  trimmedLine.contains("fun test") ||
                  trimmedLine.contains("void test"))
        }
    if (!hasTestMethods) {
      return false
    }
  }

  // Check if file is entirely commented out
  if (nonEmptyLines.isNotEmpty() && nonEmptyLines.all { it.trim().startsWith("//") }) {
    return false
  }

  // Look for test annotations or test methods that are NOT commented out
  val testIndicators =
      listOf(
          "@Test",
          "@org.junit.Test",
          "@org.junit.jupiter.api.Test",
          "@kotlin.test.Test",
          "@ExtendWith",
          "@Nested",
          "@ParameterizedTest",
          "@RepeatedTest",
          "@TestFactory",
          "fun test",
          "void test",
          "public void test")

  // Check each line to ensure test indicators are not commented out
  return lines.any { line ->
    val trimmedLine = line.trim()
    if (trimmedLine.startsWith("//")) {
      false // Skip commented lines
    } else {
      testIndicators.any { indicator -> trimmedLine.contains(indicator) }
    }
  }
}

// Create a class loader for test classes
private fun createTestClassLoader(
    testTask: Task,
    logger: org.gradle.api.logging.Logger
): ClassLoader {
  return try {
    val allPaths = mutableListOf<java.net.URL>()

    // Add test classpath if it's a Test task
    if (testTask is org.gradle.api.tasks.testing.Test) {
      allPaths.addAll(testTask.classpath.files.map { it.toURI().toURL() })
      allPaths.addAll(testTask.testClassesDirs.files.map { it.toURI().toURL() })
    } else {
      // Fallback: use project configurations
      val project = testTask.project
      val testRuntimeClasspath = project.configurations.findByName("testRuntimeClasspath")
      val testCompileClasspath = project.configurations.findByName("testCompileClasspath")

      testRuntimeClasspath?.files?.forEach { allPaths.add(it.toURI().toURL()) }
      testCompileClasspath?.files?.forEach { allPaths.add(it.toURI().toURL()) }

      // Add build directories
      val buildDir = project.layout.buildDirectory.get().asFile
      listOf(
              File(buildDir, "classes/java/main"),
              File(buildDir, "classes/kotlin/main"),
              File(buildDir, "classes/java/test"),
              File(buildDir, "classes/kotlin/test"))
          .filter { it.exists() }
          .forEach { allPaths.add(it.toURI().toURL()) }
    }

    logger.debug("${testTask.path}: Created test class loader with ${allPaths.size} paths")
    java.net.URLClassLoader(allPaths.toTypedArray(), Thread.currentThread().contextClassLoader)
  } catch (e: Exception) {
    logger.warn("${testTask.path}: Failed to create test class loader: ${e.message}")
    Thread.currentThread().contextClassLoader
  }
}

// Discover test classes in a directory using runtime class inspection
private fun discoverTestClasses(
    classDir: File,
    classLoader: ClassLoader,
    testClassNames: MutableMap<String, String>,
    logger: org.gradle.api.logging.Logger
) {
  logger.info("Discovering test classes in directory: ${classDir.absolutePath}")

  val classFiles =
      classDir.walkTopDown().filter { it.isFile && it.name.endsWith(".class") }.toList()

  logger.info("Found ${classFiles.size} .class files in ${classDir.absolutePath}")

  classFiles.forEach { classFile ->
    logger.info("Processing class file: ${classFile.name}")
    try {
      val className = getClassNameFromFile(classFile, classDir)
      logger.info("Extracted class name: $className from ${classFile.name}")

      if (className != null) {
        val clazz = classLoader.loadClass(className)
        logger.info("Successfully loaded class: ${clazz.name}")

        // Use JUnit Platform to determine if this is actually a test class
        if (isActualTestClass(clazz, logger)) {
          val testClasses = inspectTestClass(clazz, logger)
          logger.info(
              "Found ${testClasses.size} test classes in ${clazz.name}: ${testClasses.keys}")
          testClassNames.putAll(testClasses)
        } else {
          logger.info("${clazz.name}: Not a test class according to JUnit discovery")
        }
      } else {
        logger.info("Could not extract class name from ${classFile.name}")
      }
    } catch (e: Throwable) {
      // Catch all throwables including NoClassDefFoundError, LinkageError, etc.
      logger.info(
          "${classFile.name}: Failed to load class: ${e.javaClass.simpleName}: ${e.message}")
    }
  }

  logger.info("Total test classes discovered: ${testClassNames.size}")
}

// Use JUnit Platform to discover if a class is actually a test class
internal fun isActualTestClass(clazz: Class<*>, logger: org.gradle.api.logging.Logger): Boolean {
  return try {
    // Skip classes that are obviously not test classes
    if (shouldSkipClass(clazz)) {
      logger.debug("${clazz.name}: Skipping class - not a test class type")
      return false
    }

    // Create a JUnit discovery request for this specific class
    val request: LauncherDiscoveryRequest =
        LauncherDiscoveryRequestBuilder.request()
            .selectors(DiscoverySelectors.selectClass(clazz))
            .build()

    // Use the global JUnit launcher to discover tests
    val testPlan = junitLauncher.discover(request)

    // Check if any test methods were discovered
    val hasTests = testPlan.roots.any { root -> testPlan.getChildren(root).isNotEmpty() }

    logger.debug("${clazz.name}: JUnit discovery found tests: $hasTests")
    hasTests
  } catch (e: Exception) {
    logger.debug("${clazz.name}: JUnit discovery failed: ${e.message}")
    // If JUnit Platform discovery fails, don't create a CI target
    // This is the most reliable approach - if JUnit can't find tests, we shouldn't either
    false
  }
}

// Check if a class should be skipped for test discovery
internal fun shouldSkipClass(clazz: Class<*>): Boolean {
  // Skip interfaces, enums, and annotation types
  if (clazz.isInterface || clazz.isEnum || clazz.isAnnotation) {
    return true
  }

  // Skip abstract classes
  if (java.lang.reflect.Modifier.isAbstract(clazz.modifiers)) {
    return true
  }

  // Skip data classes - they typically don't contain test methods
  if (isDataClass(clazz)) {
    return true
  }

  return false
}

// Check if a class is a Kotlin data class
internal fun isDataClass(clazz: Class<*>): Boolean {
  return try {
    // Kotlin data classes have specific characteristics:
    // 1. They have a copy method with the right signature
    // 2. They have componentN methods
    val methods = clazz.declaredMethods
    val hasCopyMethod = methods.any { it.name == "copy" }
    val hasComponentMethods = methods.any { it.name.startsWith("component") }

    hasCopyMethod && hasComponentMethods
  } catch (e: Exception) {
    false
  }
}

// Get class name from compiled class file
internal fun getClassNameFromFile(classFile: File, classDir: File): String? {
  return try {
    val relativePath = classDir.toPath().relativize(classFile.toPath()).toString()
    val className = relativePath.removeSuffix(".class").replace(File.separatorChar, '.')

    // Skip inner classes, anonymous classes, and other generated classes
    if (className.isEmpty() || className.contains("$")) {
      return null
    }

    className
  } catch (e: Exception) {
    null
  }
}

// Inspect a loaded class for test annotations and nested test classes
internal fun inspectTestClass(
    clazz: Class<*>,
    logger: org.gradle.api.logging.Logger
): Map<String, String> {
  val result = mutableMapOf<String, String>()

  try {
    logger.info("Inspecting class: ${clazz.name}")

    // Skip interfaces, enums, and annotation types
    if (clazz.isInterface || clazz.isEnum || clazz.isAnnotation) {
      logger.info("Skipping ${clazz.name} - interface/enum/annotation")
      return result
    }

    // Check for test annotations on the class
    val hasClassTestAnnotations = hasClassTestAnnotations(clazz)
    val hasMethodTestAnnotations = hasMethodTestAnnotations(clazz)

    logger.info(
        "${clazz.name} - Class annotations: $hasClassTestAnnotations, Method annotations: $hasMethodTestAnnotations")

    // Get nested classes with @Nested annotation
    val nestedTestClasses =
        try {
          clazz.declaredClasses.filter { nestedClass ->
            !nestedClass.isInterface &&
                !nestedClass.isEnum &&
                !nestedClass.isAnnotation &&
                isNestedTestClass(nestedClass)
          }
        } catch (e: Throwable) {
          // Ignore classes with unavailable dependencies
          logger.info("Failed to get nested classes for ${clazz.name}: ${e.message}")
          emptyList()
        }

    logger.info("${clazz.name} - Found ${nestedTestClasses.size} nested test classes")

    if (nestedTestClasses.isNotEmpty()) {
      // Process nested test classes
      nestedTestClasses.forEach { nestedClass ->
        val simpleName = nestedClass.simpleName
        val nestedKey = "${clazz.simpleName}$simpleName"
        result[nestedKey] = nestedClass.name
        logger.info("Added nested test class: $nestedKey -> ${nestedClass.name}")
      }
    } else if (hasClassTestAnnotations || hasMethodTestAnnotations) {
      // Include the main class if it has test annotations
      result[clazz.simpleName] = clazz.name
      logger.info("Added main test class: ${clazz.simpleName} -> ${clazz.name}")
    } else {
      logger.info("${clazz.name} - No test annotations found")
    }

    logger.info("${clazz.simpleName}: Found ${result.size} test classes")
  } catch (e: Exception) {
    logger.warn("Failed to inspect class ${clazz.name}: ${e.message}")
  }

  return result
}

// Check if a class has class-level test annotations
internal fun hasClassTestAnnotations(clazz: Class<*>): Boolean {
  return try {
    clazz.annotations.any { annotation ->
      val annotationName = annotation.annotationClass.simpleName
      val qualifiedName = annotation.annotationClass.qualifiedName
      classTestAnnotationNames.contains(annotationName) ||
          classQualifiedTestAnnotations.contains(qualifiedName)
    }
  } catch (e: Throwable) {
    // Ignore classes that reference unavailable dependencies
    false
  }
}

// Check if a class has method-level test annotations
internal fun hasMethodTestAnnotations(clazz: Class<*>): Boolean {
  return try {
    clazz.declaredMethods.any { method ->
      try {
        method.annotations.any { annotation ->
          val annotationName = annotation.annotationClass.simpleName
          val qualifiedName = annotation.annotationClass.qualifiedName
          methodTestAnnotationNames.contains(annotationName) ||
              methodQualifiedTestAnnotations.contains(qualifiedName)
        }
      } catch (e: Throwable) {
        false
      }
    }
  } catch (e: Throwable) {
    // Ignore classes that reference unavailable dependencies
    false
  }
}

// Check if a nested class is a test class with @Nested annotation
internal fun isNestedTestClass(nestedClass: Class<*>): Boolean {
  return try {
    nestedClass.annotations.any { annotation ->
      val annotationName = annotation.annotationClass.simpleName
      val qualifiedName = annotation.annotationClass.qualifiedName
      annotationName == "Nested" || qualifiedName == "org.junit.jupiter.api.Nested"
    }
  } catch (e: Throwable) {
    // Ignore classes that reference unavailable dependencies
    false
  }
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
  val dependsOnTasks = getDependsOnTask(testTask)
  val taskInputs = getInputsForTask(dependsOnTasks, testTask, projectRoot, workspaceRoot)

  // Ensure executor is never null or undefined by using a constant
  val executorValue = "@nx/gradle:gradle"

  val target =
      mutableMapOf<String, Any?>(
          "executor" to executorValue,
          "options" to
              mapOf(
                  "taskName" to "${projectBuildPath}:${testTask.name}",
                  "testClassName" to testClassPackagePath),
          "metadata" to
              getMetadata("Runs Gradle test $testClassPackagePath in CI", projectBuildPath, "test"),
          "cache" to true,
          "inputs" to taskInputs)

  // Defensive check to ensure executor is never null or empty
  val currentExecutor = target["executor"]
  if (currentExecutor == null || currentExecutor.toString().isEmpty()) {
    testTask.logger.warn("${testTask.path}: executor is null or empty, setting to default")
    target["executor"] = executorValue
  }

  // Debug logging to trace executor value
  testTask.logger.info("${testTask.path}: Created target with executor: ${target["executor"]}")

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
