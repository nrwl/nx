package dev.nx.gradle.utils.parsing

import java.io.File
import org.gradle.api.Task

/**
 * Main entry point for parsing test files to extract test classes. Uses AST parsing for Java and
 * Kotlin files, falls back to regex parsing.
 */
fun getAllVisibleClassesWithNestedAnnotation(
    file: File,
    testTask: Task? = null
): MutableMap<String, String>? {
  val logger = testTask?.logger

  logger?.info("=== Processing test file: ${file.name} ===")

  // Use AST-based parsing
  val result =
      when {
        file.name.endsWith(".java") -> {
          logger?.info("Attempting Java AST parsing for: ${file.name}")
          try {
            val astResult = parseJavaFileWithAst(file)
            if (astResult != null && astResult.isNotEmpty()) {
              logger?.info(
                  "Java AST parsing successful for: ${file.name}, found ${astResult.size} classes: ${astResult.keys}")
              astResult
            } else {
              logger?.info(
                  "Java AST parsing returned empty/null, falling back to regex for: ${file.name}")
              parseTestClassesWithRegex(file)
            }
          } catch (e: Exception) {
            logger?.warn(
                "Java AST parsing exception for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
            logger?.info("Falling back to regex parsing for: ${file.name}")
            parseTestClassesWithRegex(file)
          } catch (e: Error) {
            logger?.warn(
                "Java AST parsing error for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
            logger?.info("Falling back to regex parsing for: ${file.name}")
            parseTestClassesWithRegex(file)
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
              return parseTestClassesWithRegex(file)
            }

            // Create Kotlin environment
            val envPair = createKotlinEnvironment()
            if (envPair == null) {
              logger?.warn("Failed to create Kotlin environment, falling back to regex")
              return parseTestClassesWithRegex(file)
            }

            val (disposable, psiManager) = envPair
            try {
              val astResult = parseKotlinFileWithAst(file, psiManager, logger)
              return if (astResult != null) {
                astResult
              } else {
                parseTestClassesWithRegex(file)
              }
            } finally {
              disposable.dispose() // Always clean up resources
            }

            if (astResult != null) {
              logger?.info("Successfully used Kotlin AST parsing for: ${file.name}")
              astResult
            } else {
              logger?.info("Kotlin AST parsing failed, falling back to regex for: ${file.name}")
              parseTestClassesWithRegex(file)
            }
          } catch (e: Exception) {
            logger?.warn(
                "Kotlin AST parsing failed for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
            logger?.debug(
                "Exception details: ${e.stackTrace.take(3).joinToString { it.toString() }}")
            logger?.info("Falling back to regex parsing for: ${file.name}")
            parseTestClassesWithRegex(file)
          } catch (e: Error) {
            // Catch JVM errors like NoClassDefFoundError, LinkageError, etc.
            logger?.warn(
                "Kotlin AST parsing failed for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
            logger?.debug("Error details: ${e.stackTrace.take(3).joinToString { it.toString() }}")
            logger?.info("Falling back to regex parsing for: ${file.name}")
            parseTestClassesWithRegex(file)
          }
        }
        else -> {
          logger?.info("Using regex parsing for non-Java/Kotlin file: ${file.name}")
          parseTestClassesWithRegex(file)
        }
      }

  logger?.info("Final result for ${file.name}: ${result?.keys}")
  return result
}
