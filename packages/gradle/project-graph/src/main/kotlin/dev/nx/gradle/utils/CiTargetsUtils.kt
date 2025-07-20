package dev.nx.gradle.utils

import com.github.javaparser.JavaParser
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration
import dev.nx.gradle.data.NxTargets
import dev.nx.gradle.data.TargetGroups
import java.io.File
import org.gradle.api.Task
import org.gradle.api.file.FileCollection

const val testCiTargetGroup = "verification"

// Regex patterns for fallback parsing (kept for compatibility and fallback scenarios)
private val packageDeclarationRegex =
    Regex(
        """^\s*package\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*$""",
        RegexOption.MULTILINE)
private val classDeclarationRegex =
    Regex(
        """^\s*(?:@\w+\s*)*(?:public|open|sealed|final|enum|annotation)?\s*(class)\s+([A-Za-z_][A-Za-z0-9_]*)""")
private val excludedClassRegex =
    Regex("""^\s*(?:@\w+\s*)*(?:private|internal)\s+class\s+([A-Za-z_][A-Za-z0-9_]*)""")
private val abstractClassRegex =
    Regex(
        """^\s*(?:@\w+\s*)*(?:public\s+|protected\s+)?abstract\s+class\s+([A-Za-z_][A-Za-z0-9_]*)""")

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

// Combined test annotation names for general use
private val testAnnotationNames = classTestAnnotationNames + methodTestAnnotationNames

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

// Combined qualified annotation names for general use
private val qualifiedTestAnnotations =
    classQualifiedTestAnnotations + methodQualifiedTestAnnotations

// Configuration annotations that should be excluded from test target generation
private val configurationAnnotations =
    setOf(
        "TestConfiguration",
        "Configuration",
        "ComponentScan",
        "EntityScan",
        "EnableAutoConfiguration",
        "SpringBootConfiguration",
        "org.springframework.boot.test.context.TestConfiguration",
        "org.springframework.context.annotation.Configuration",
        "org.springframework.context.annotation.ComponentScan",
        "org.springframework.boot.autoconfigure.domain.EntityScan",
        "org.springframework.boot.autoconfigure.EnableAutoConfiguration",
        "org.springframework.boot.SpringBootConfiguration")

// Singleton instances for heavy objects to avoid recreation
private val javaParser by lazy {
  try {
    JavaParser().apply {
      // Use the latest available language level for better compatibility
      parserConfiguration.setLanguageLevel(
          com.github.javaparser.ParserConfiguration.LanguageLevel.CURRENT)
    }
  } catch (e: Exception) {
    // Fallback to default parser if configuration fails
    JavaParser()
  }
}

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

  // Use JUnit discovery when available, fall back to AST/regex parsing
  testTask.logger.info(
      "${testTask.path}: Processing test files with JUnit discovery and AST parsing")
  processTestFiles(
      testFiles,
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

    // Create a class loader for the test classes
    val testClassLoader = createTestClassLoader(testTask, testTask.logger)

    testClassDirs.forEach { classDir ->
      discoverTestClasses(classDir, testClassLoader, testClassNames, testTask.logger)
    }
  }

  // Fall back to regex parsing if no compiled classes found or no test classes discovered
  if (testClassNames.isEmpty()) {
    testTask.logger.info(
        "${testTask.path}: No compiled test classes found, falling back to regex parsing")

    // Use regex parsing to find test classes in source files
    testFiles.forEach { file ->
      if (file.exists() && (file.extension == "kt" || file.extension == "java")) {
        try {
          val content = file.readText()
          val className = extractClassNameFromFile(file, content)

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
private fun extractClassNameFromFile(file: File, content: String): String? {
  // Try to extract class name from the file content
  val classRegex = Regex("class\\s+(\\w+)")
  val match = classRegex.find(content)
  return match?.groupValues?.get(1)
}

// Helper function to check if content contains test methods or annotations
private fun isTestClassByRegex(content: String): Boolean {
  // Skip abstract classes as they can't be instantiated
  if (content.contains("abstract class")) {
    return false
  }

  // Look for test annotations or test methods
  val testIndicators =
      listOf(
          "@Test",
          "@org.junit.Test",
          "@org.junit.jupiter.api.Test",
          "@ExtendWith",
          "@Nested",
          "fun test",
          "void test",
          "public void test")

  return testIndicators.any { content.contains(it) }
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
  classDir
      .walkTopDown()
      .filter { it.isFile && it.name.endsWith(".class") }
      .forEach { classFile ->
        try {
          val className = getClassNameFromFile(classFile, classDir)
          if (className != null) {
            val clazz = classLoader.loadClass(className)
            val testClasses = inspectTestClass(clazz, logger)
            testClassNames.putAll(testClasses)
          }
        } catch (e: Throwable) {
          // Catch all throwables including NoClassDefFoundError, LinkageError, etc.
          logger.debug(
              "${classFile.name}: Failed to load class: ${e.javaClass.simpleName}: ${e.message}")
        }
      }
}

// Get class name from compiled class file
internal fun getClassNameFromFile(classFile: File, classDir: File): String? {
  return try {
    val relativePath = classDir.toPath().relativize(classFile.toPath()).toString()
    relativePath.removeSuffix(".class").replace(File.separatorChar, '.')
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
    // Skip interfaces, enums, and annotation types
    if (clazz.isInterface || clazz.isEnum || clazz.isAnnotation) {
      return result
    }

    // Check for test annotations on the class
    val hasClassTestAnnotations = hasClassTestAnnotations(clazz)
    val hasMethodTestAnnotations = hasMethodTestAnnotations(clazz)

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
          emptyList()
        }

    if (nestedTestClasses.isNotEmpty()) {
      // Process nested test classes
      nestedTestClasses.forEach { nestedClass ->
        val simpleName = nestedClass.simpleName
        val nestedKey = "${clazz.simpleName}$simpleName"
        result[nestedKey] = nestedClass.name
      }
    } else if (hasClassTestAnnotations || hasMethodTestAnnotations) {
      // Include the main class if it has test annotations
      result[clazz.simpleName] = clazz.name
    }

    logger.debug("${clazz.simpleName}: Found ${result.size} test classes")
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
        // Ignore classes that reference unavailable dependencies
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

// Check if a class has test annotations (on class or methods)
private fun hasTestAnnotationsInClass(classDecl: ClassOrInterfaceDeclaration): Boolean {
  // First check if this is a configuration class - if so, exclude it
  if (classDecl.annotations.any { isConfigurationAnnotation(it.nameAsString) }) {
    return false
  }

  // Check class-level annotations
  if (classDecl.annotations.any { isClassTestAnnotation(it.nameAsString) }) {
    return true
  }

  // Check method-level annotations (only direct methods, not nested class methods)
  return classDecl.methods.any { method ->
    method.annotations.any { isMethodTestAnnotation(it.nameAsString) }
  }
}

// Check if a class has method-level test annotations (not just class-level)
private fun hasMethodLevelTestAnnotations(classDecl: ClassOrInterfaceDeclaration): Boolean {
  // Only look at direct methods of this class, not methods from nested classes
  return classDecl.methods.any { method ->
    method.annotations.any { isMethodTestAnnotation(it.nameAsString) }
  }
}

// Check if an annotation is a class-level test annotation
private fun isClassTestAnnotation(annotationName: String): Boolean {
  return classTestAnnotationNames.contains(annotationName) ||
      classQualifiedTestAnnotations.contains(annotationName)
}

// Check if an annotation is a method-level test annotation
private fun isMethodTestAnnotation(annotationName: String): Boolean {
  return methodTestAnnotationNames.contains(annotationName) ||
      methodQualifiedTestAnnotations.contains(annotationName)
}

// Check if an annotation is a test annotation (combined for general use)
private fun isTestAnnotation(annotationName: String): Boolean {
  return testAnnotationNames.contains(annotationName) ||
      qualifiedTestAnnotations.contains(annotationName)
}

// Check if an annotation is a configuration annotation (should be excluded)
private fun isConfigurationAnnotation(annotationName: String): Boolean {
  return configurationAnnotations.contains(annotationName)
}

// Check if a class has @Nested annotation
private fun hasNestedAnnotation(classDecl: ClassOrInterfaceDeclaration): Boolean {
  return classDecl.annotations.any {
    it.nameAsString == "Nested" || it.nameAsString == "org.junit.jupiter.api.Nested"
  }
}

// Check if a class has configuration annotations (for regex parsing)
private fun hasConfigurationAnnotationsInContent(
    lines: List<String>,
    classLineIndex: Int
): Boolean {
  // Look at the few lines before the class declaration for annotations
  val startIndex = maxOf(0, classLineIndex - 10)
  val endIndex = minOf(lines.size - 1, classLineIndex)

  for (i in startIndex until endIndex) {
    val line = lines[i].trim()
    if (line.startsWith("@")) {
      // Extract annotation name (remove @ and parameters)
      val annotationName = line.substring(1).split("(")[0].trim()
      if (isConfigurationAnnotation(annotationName)) {
        return true
      }
    }
  }
  return false
}

// Check if a class has method-level test annotations (for regex parsing)
private fun hasMethodLevelTestAnnotationsInContent(
    lines: List<String>,
    classLineIndex: Int
): Boolean {
  // Look for method-level test annotations after the class declaration
  val classEndIndex = findClassEndIndex(lines, classLineIndex)
  var braceLevel = 0
  var foundClassOpenBrace = false

  for (i in classLineIndex + 1 until classEndIndex) {
    val line = lines[i].trim()

    // Track brace levels to avoid looking inside nested classes
    for (char in line) {
      when (char) {
        '{' -> {
          braceLevel++
          if (!foundClassOpenBrace) {
            foundClassOpenBrace = true
          }
        }
        '}' -> {
          braceLevel--
        }
      }
    }

    // Only look at annotations at the top level of this class (braceLevel == 1)
    // Skip nested classes (braceLevel > 1)
    if (foundClassOpenBrace && braceLevel == 1 && line.startsWith("@")) {
      // Extract annotation name (remove @ and parameters)
      val annotationName = line.substring(1).split("(")[0].trim()
      if (isMethodTestAnnotation(annotationName)) {
        return true
      }
    }
  }
  return false
}

// Find the end index of a class declaration (simplified heuristic)
private fun findClassEndIndex(lines: List<String>, classStartIndex: Int): Int {
  var braceCount = 0
  var foundOpenBrace = false

  for (i in classStartIndex until lines.size) {
    val line = lines[i]
    for (char in line) {
      when (char) {
        '{' -> {
          braceCount++
          foundOpenBrace = true
        }
        '}' -> {
          braceCount--
          if (foundOpenBrace && braceCount == 0) {
            return i
          }
        }
      }
    }
  }
  return lines.size - 1
}

// Check if a class has nested classes with @Nested annotation (for regex parsing)
private fun hasNestedTestClassesInContent(
    lines: List<String>,
    classLineIndex: Int,
    className: String
): Boolean {
  val classEndIndex = findClassEndIndex(lines, classLineIndex)
  var braceLevel = 0
  var foundClassOpenBrace = false
  var previousLine: String? = null

  for (i in classLineIndex + 1 until classEndIndex) {
    val line = lines[i].trim()

    // Track brace levels
    for (char in line) {
      when (char) {
        '{' -> {
          braceLevel++
          if (!foundClassOpenBrace) {
            foundClassOpenBrace = true
          }
        }
        '}' -> {
          braceLevel--
        }
      }
    }

    // Look for nested class declarations at brace level 1 (direct children)
    if (foundClassOpenBrace && braceLevel == 1) {
      val match = classDeclarationRegex.find(line)
      if (match != null) {
        val isAnnotatedNested = previousLine?.trimStart()?.startsWith("@Nested") == true
        if (isAnnotatedNested) {
          return true
        }
      }
    }

    previousLine = line
  }
  return false
}

// Process nested classes with @Nested annotation (for regex parsing)
private fun processNestedClassesInContent(
    lines: List<String>,
    classLineIndex: Int,
    parentClassName: String,
    packageName: String?,
    result: MutableMap<String, String>
) {
  val classEndIndex = findClassEndIndex(lines, classLineIndex)
  var braceLevel = 0
  var foundClassOpenBrace = false
  var previousLine: String? = null

  for (i in classLineIndex + 1 until classEndIndex) {
    val line = lines[i].trim()

    // Track brace levels
    for (char in line) {
      when (char) {
        '{' -> {
          braceLevel++
          if (!foundClassOpenBrace) {
            foundClassOpenBrace = true
          }
        }
        '}' -> {
          braceLevel--
        }
      }
    }

    // Look for nested class declarations at brace level 1 (direct children)
    if (foundClassOpenBrace && braceLevel == 1) {
      val match = classDeclarationRegex.find(line)
      if (match != null) {
        val nestedClassName = match.groupValues.getOrNull(2)
        val isAnnotatedNested = previousLine?.trimStart()?.startsWith("@Nested") == true

        if (isAnnotatedNested && nestedClassName != null) {
          val nestedKey = "$parentClassName$nestedClassName"
          val nestedValue =
              if (packageName != null) {
                "$packageName.$parentClassName$$nestedClassName"
              } else {
                "$parentClassName$$nestedClassName"
              }
          result[nestedKey] = nestedValue
        }
      }
    }

    previousLine = line
  }
}

// Legacy function - no longer used since we switched to Gradle test discovery
internal fun fallbackToRegexParsing(file: File): MutableMap<String, String>? {
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

    // Skip private, internal, and abstract classes
    if (excludedClassRegex.containsMatchIn(trimmed)) continue
    if (abstractClassRegex.containsMatchIn(trimmed)) continue

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
      // Exclude top-level @nested classes and configuration classes
      if (!isAnnotatedNested && !hasConfigurationAnnotationsInContent(lines, i)) {

        // Check if this class has nested classes with @Nested annotation
        val hasNestedClasses = hasNestedTestClassesInContent(lines, i, className)

        if (hasNestedClasses) {
          // This top-level class has @Nested children - process them instead of the parent
          processNestedClassesInContent(lines, i, className, packageName, result)
        } else {
          // No @Nested children - include parent if it has method-level test annotations
          if (hasMethodLevelTestAnnotationsInContent(lines, i)) {
            result.put(className, packageName?.let { "$it.$className" } ?: className)
          }
        }
      }
      classStack.clear()
      classStack.add(className to indent)
    } else {
      // Maintain nesting stack
      while (classStack.isNotEmpty() && indent <= classStack.last().second) {
        classStack.removeLast()
      }

      val parent = classStack.lastOrNull()?.first
      if (isAnnotatedNested && parent != null && !hasConfigurationAnnotationsInContent(lines, i)) {
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
