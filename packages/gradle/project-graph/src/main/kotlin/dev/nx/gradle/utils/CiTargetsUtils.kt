package dev.nx.gradle.utils

import com.github.javaparser.JavaParser
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration
import dev.nx.gradle.data.NxTargets
import dev.nx.gradle.data.TargetGroups
import java.io.File
import org.gradle.api.Task
import org.gradle.api.file.FileCollection
import org.jetbrains.kotlin.cli.jvm.compiler.EnvironmentConfigFiles
import org.jetbrains.kotlin.cli.jvm.compiler.KotlinCoreEnvironment
import org.jetbrains.kotlin.com.intellij.openapi.util.Disposer
import org.jetbrains.kotlin.com.intellij.psi.PsiManager
import org.jetbrains.kotlin.com.intellij.testFramework.LightVirtualFile
import org.jetbrains.kotlin.config.CompilerConfiguration
import org.jetbrains.kotlin.idea.KotlinFileType
import org.jetbrains.kotlin.lexer.KtTokens
import org.jetbrains.kotlin.psi.KtClass
import org.jetbrains.kotlin.psi.KtFile
import org.jetbrains.kotlin.psi.psiUtil.getChildrenOfType

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
  testFiles
      .filter { it.path.startsWith(workspaceRoot) }
      .forEach { testFile ->
        val content = testFile.takeIf { it.exists() }?.readText()
        if (content != null && containsEssentialTestAnnotations(content)) {
          val classNames = getAllVisibleClassesWithNestedAnnotation(testFile, testTask)
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

private fun containsEssentialTestAnnotations(content: String): Boolean {
  return essentialTestAnnotations.any { content.contains(it) }
}

// AST-based parser for Java files
internal fun parseJavaFileWithAst(file: File): MutableMap<String, String>? {
  return try {
    val parseResult = javaParser.parse(file)

    if (!parseResult.isSuccessful) {
      return null
    }

    val compilationUnit = parseResult.result.orElse(null) ?: return null
    val result = mutableMapOf<String, String>()
    val packageName = compilationUnit.packageDeclaration.map { it.nameAsString }.orElse("")

    // Find only top-level class declarations (excluding interfaces)
    val topLevelClasses = compilationUnit.types.filterIsInstance<ClassOrInterfaceDeclaration>()

    topLevelClasses.forEach { classDecl ->
      // Skip interfaces and annotation definitions - only process classes
      if (!classDecl.isInterface && !classDecl.isAnnotationDeclaration) {
        // Skip abstract classes - they shouldn't have individual test targets
        if (classDecl.isAbstract) {
          return@forEach
        }

        val className = classDecl.nameAsString
        val hasTestAnnotations = hasTestAnnotationsInClass(classDecl)

        // Check for direct nested classes with @Nested annotation (also excluding interfaces and
        // abstract classes)
        val nestedTestClasses =
            classDecl.members.filterIsInstance<ClassOrInterfaceDeclaration>().filter {
              !it.isInterface && !it.isAbstract && hasNestedAnnotation(it)
            }

        // If there are @Nested test classes, include them
        if (nestedTestClasses.isNotEmpty()) {
          nestedTestClasses.forEach { nestedClass ->
            val nestedClassName = nestedClass.nameAsString
            val nestedFullName =
                if (packageName.isNotEmpty()) "$packageName.$className$$nestedClassName"
                else "$className$$nestedClassName"
            result["$className$nestedClassName"] = nestedFullName
          }
        }

        // Include parent class only if it has executable test content
        // Classes with only setup/configuration annotations (@ExtendWith, @TestPropertySource)
        // should not generate targets unless they have actual test methods or nested test classes
        if (hasTestAnnotations) {
          val shouldIncludeParent =
              if (nestedTestClasses.isNotEmpty()) {
                // If there are nested classes, only include parent if it has method-level test
                // annotations
                hasMethodLevelTestAnnotations(classDecl)
              } else {
                // If no nested classes, only include parent if it has method-level test annotations
                // Classes with only class-level annotations (@ExtendWith, @TestPropertySource) are
                // excluded
                hasMethodLevelTestAnnotations(classDecl)
              }

          if (shouldIncludeParent) {
            val fullName = if (packageName.isNotEmpty()) "$packageName.$className" else className
            result[className] = fullName
          }
        } else if (hasMethodLevelTestAnnotations(classDecl)) {
          // Include classes with method-level test annotations even if they don't have class-level test annotations
          val fullName = if (packageName.isNotEmpty()) "$packageName.$className" else className
          result[className] = fullName
        }
      }
    }

    result
  } catch (e: Exception) {
    // Log the exception for debugging
    // Note: We can't access logger here since it's not passed in,
    // but the calling function will log the fallback
    null
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

// Quick check if core Kotlin compiler classes are available to avoid expensive object creation
private fun isKotlinCompilerAvailable(logger: org.gradle.api.logging.Logger? = null): Boolean {
  val requiredClasses = listOf("org.jetbrains.kotlin.cli.jvm.compiler.KotlinCoreEnvironment")

  return try {
    // Check only the most essential classes that would fail fast
    requiredClasses.forEach { className ->
      try {
        Class.forName(className)
      } catch (e: ClassNotFoundException) {
        logger?.info("Kotlin compiler class not available: $className")
        throw e
      } catch (e: NoClassDefFoundError) {
        logger?.info("Kotlin compiler class definition error: $className - ${e.message}")
        throw e
      }
    }
    true
  } catch (e: ClassNotFoundException) {
    false
  } catch (e: NoClassDefFoundError) {
    false
  }
}

// Check if a Kotlin class contains test annotations (class-level or method-level)
private fun hasTestAnnotations(ktClass: KtClass): Boolean {
  // First check if this is a configuration class - if so, exclude it
  val hasConfigurationAnnotations =
      ktClass.annotationEntries.any { annotation ->
        val annotationName = annotation.shortName?.asString()
        val fullAnnotationText = annotation.text

        // Check short names and qualified names for configuration annotations
        isConfigurationAnnotation(annotationName ?: "") ||
            configurationAnnotations.any { fullAnnotationText.contains(it) }
      }

  if (hasConfigurationAnnotations) {
    return false
  }

  // Check class-level annotations using predefined sets
  val hasClassTestAnnotations =
      ktClass.annotationEntries.any { annotation ->
        val annotationName = annotation.shortName?.asString()
        val fullAnnotationText = annotation.text

        // Check short names and qualified names for class-level annotations
        classTestAnnotationNames.contains(annotationName) ||
            classQualifiedTestAnnotations.any { fullAnnotationText.contains(it) }
      }

  if (hasClassTestAnnotations) {
    return true
  }

  // Check method-level annotations using predefined sets
  val methods =
      ktClass.body?.children?.filterIsInstance<org.jetbrains.kotlin.psi.KtNamedFunction>()
          ?: emptyList()
  return methods.any { method ->
    method.annotationEntries.any { annotation ->
      val annotationName = annotation.shortName?.asString()
      val fullAnnotationText = annotation.text

      // Check short names and qualified names for method-level annotations
      methodTestAnnotationNames.contains(annotationName) ||
          methodQualifiedTestAnnotations.any { fullAnnotationText.contains(it) }
    }
  }
}

// True AST-based parser for Kotlin files using Kotlin compiler
internal fun parseKotlinFileWithAst(
    file: File,
    psiManager: PsiManager,
    logger: org.gradle.api.logging.Logger? = null
): MutableMap<String, String>? {
  return try {
    val content = file.readText()
    val result = mutableMapOf<String, String>()

    // Create virtual file and parse it using provided PsiManager
    val ktFile =
        try {
          val virtualFile = LightVirtualFile(file.name, KotlinFileType.INSTANCE, content)
          psiManager.findFile(virtualFile) as? KtFile
        } catch (e: Exception) {
          logger?.warn(
              "PSI parsing error for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
          return null
        } ?: return null

    // Get package name - use regex as fallback since AST sometimes fails on temp files
    val packageNameFromAST = ktFile.packageFqName.asString()
    val packageName =
        if (packageNameFromAST.isNotEmpty()) {
          packageNameFromAST
        } else {
          // Fallback to regex parsing
          packageDeclarationRegex.find(content)?.groupValues?.get(1) ?: ""
        }

    // Process all top-level classes
    val topLevelClasses = ktFile.getChildrenOfType<KtClass>()

    for (topClass in topLevelClasses) {
      processClass(topClass, packageName, null, result)
    }

    result
  } catch (e: Exception) {
    // Fall back to regex parsing if AST parsing fails
    logger?.warn(
        "Kotlin AST parsing failed for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
    null
  }
}

private fun processClass(
    ktClass: KtClass,
    packageName: String,
    parentClass: KtClass?,
    result: MutableMap<String, String>
) {
  val className = ktClass.name ?: return

  // Only include regular classes - skip data classes, object declarations, enum classes, etc.
  if (ktClass.hasModifier(KtTokens.DATA_KEYWORD) ||
      ktClass.hasModifier(KtTokens.ENUM_KEYWORD) ||
      ktClass.hasModifier(KtTokens.SEALED_KEYWORD) ||
      ktClass.hasModifier(KtTokens.ANNOTATION_KEYWORD)) {
    return
  }

  // Skip object declarations (they're a different type but check anyway)
  if (ktClass.isInterface()) {
    return
  }

  // Skip private and internal classes
  if (ktClass.hasModifier(KtTokens.PRIVATE_KEYWORD) ||
      ktClass.hasModifier(KtTokens.INTERNAL_KEYWORD)) {
    return
  }

  // Skip abstract classes for top-level classes
  if (parentClass == null && ktClass.hasModifier(KtTokens.ABSTRACT_KEYWORD)) {
    return
  }

  // Only process classes that contain test annotations
  if (!hasTestAnnotations(ktClass)) {
    return
  }

  // Check for @Nested annotation on this class
  val hasNestedAnnotation =
      ktClass.annotationEntries.any { annotation ->
        val annotationName = annotation.shortName?.asString()
        annotationName == "Nested" || annotation.text.contains("org.junit.jupiter.api.Nested")
      }

  if (parentClass == null) {
    // Top-level class

    // Skip top-level classes with @Nested annotation (invalid usage)
    if (hasNestedAnnotation) {
      return
    }

    // Check if this class has any nested classes with @Nested annotation
    // Look for nested classes in the class body
    val nestedClasses = ktClass.body?.getChildrenOfType<KtClass>()?.toList() ?: emptyList()
    val nestedWithAnnotation =
        nestedClasses.filter { nested ->
          !nested.hasModifier(KtTokens.PRIVATE_KEYWORD) &&
              nested.annotationEntries.any { annotation ->
                val annotationName = annotation.shortName?.asString()
                annotationName == "Nested" ||
                    annotation.text.contains("org.junit.jupiter.api.Nested")
              }
        }

    if (nestedWithAnnotation.isNotEmpty()) {
      // This top-level class has @Nested children - process them instead of the parent
      for (nestedClass in nestedWithAnnotation) {
        val nestedClassName = nestedClass.name ?: continue
        val nestedKey = "$className$nestedClassName"
        val nestedValue =
            if (packageName.isNotEmpty()) {
              "$packageName.$className$$nestedClassName"
            } else {
              "$className$$nestedClassName"
            }
        result[nestedKey] = nestedValue
      }
    } else {
      // No @Nested children - include the top-level class
      val fullName = if (packageName.isNotEmpty()) "$packageName.$className" else className
      result[className] = fullName
    }
  } else {
    // This should not be reached with the current logic, but keeping for completeness
    if (hasNestedAnnotation) {
      val parentName = parentClass.name ?: return
      val nestedKey = "$parentName$className"
      val nestedValue =
          if (packageName.isNotEmpty()) {
            "$packageName.$parentName$$className"
          } else {
            "$parentName$$className"
          }
      result[nestedKey] = nestedValue
    }
  }
}

// This function returns all class names and nested class names inside a file
// Uses AST parsing for Java and Kotlin files, falls back to regex parsing
fun getAllVisibleClassesWithNestedAnnotation(
    file: File,
    testTask: Task? = null
): MutableMap<String, String>? {
  val logger = testTask?.logger
  // Use AST-based parsing
  return when {
    file.name.endsWith(".java") -> {
      logger?.info("Attempting Java AST parsing for: ${file.name}")
      try {
        val astResult = parseJavaFileWithAst(file)
        if (astResult != null) {
          logger?.info("Successfully used Java AST parsing for: ${file.name}")
          astResult
        } else {
          logger?.info("Java AST parsing failed, falling back to regex for: ${file.name}")
          fallbackToRegexParsing(file)
        }
      } catch (e: Exception) {
        logger?.warn(
            "Java AST parsing exception for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
        logger?.info("Falling back to regex parsing for: ${file.name}")
        fallbackToRegexParsing(file)
      } catch (e: Error) {
        logger?.warn(
            "Java AST parsing error for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
        logger?.info("Falling back to regex parsing for: ${file.name}")
        fallbackToRegexParsing(file)
      }
    }
    file.name.endsWith(".kt") -> {
      logger?.info("Attempting Kotlin AST parsing for: ${file.name}")
      try {
        // Check if Kotlin compiler classes are available using reflection
        if (!isKotlinCompilerAvailable(logger)) {
          logger?.info("Kotlin compiler not available, using regex parsing for: ${file.name}")
          logger?.debug(
              "Kotlin AST parsing failed: Required Kotlin compiler classes not found on classpath")
          return fallbackToRegexParsing(file)
        }

        // Create PsiManager directly with proper error handling
        val disposable = Disposer.newDisposable()
        val compilerConfiguration =
            try {
              CompilerConfiguration()
            } catch (e: NoClassDefFoundError) {
              logger?.warn("CompilerConfiguration initialization failed: ${e.message}")
              logger?.info("Falling back to regex parsing for: ${file.name}")
              return fallbackToRegexParsing(file)
            }

        val environment =
            KotlinCoreEnvironment.createForProduction(
                disposable, compilerConfiguration, EnvironmentConfigFiles.JVM_CONFIG_FILES)
        val psiManager = PsiManager.getInstance(environment.project)

        val astResult = parseKotlinFileWithAst(file, psiManager, logger)
        disposable.dispose() // Clean up resources

        if (astResult != null) {
          logger?.info("Successfully used Kotlin AST parsing for: ${file.name}")
          astResult
        } else {
          logger?.info("Kotlin AST parsing failed, falling back to regex for: ${file.name}")
          fallbackToRegexParsing(file)
        }
      } catch (e: Exception) {
        logger?.warn(
            "Kotlin AST parsing failed for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
        logger?.debug("Exception details: ${e.stackTrace.take(3).joinToString { it.toString() }}")
        logger?.info("Falling back to regex parsing for: ${file.name}")
        fallbackToRegexParsing(file)
      } catch (e: Error) {
        // Catch JVM errors like NoClassDefFoundError, LinkageError, etc.
        logger?.warn(
            "Kotlin AST parsing failed for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
        logger?.debug("Error details: ${e.stackTrace.take(3).joinToString { it.toString() }}")
        logger?.info("Falling back to regex parsing for: ${file.name}")
        fallbackToRegexParsing(file)
      }
    }
    else -> {
      logger?.info("Using regex parsing for non-Java/Kotlin file: ${file.name}")
      fallbackToRegexParsing(file)
    }
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

// Fallback to original regex-based parsing when AST parsing fails
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
