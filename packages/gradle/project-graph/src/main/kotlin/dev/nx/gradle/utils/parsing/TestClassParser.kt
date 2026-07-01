package dev.nx.gradle.utils.parsing

import java.io.File
import java.time.Instant
import org.gradle.api.Task

enum class ParsingMethod {
  AST,
  REGEX
}

data class ParseResult(val classes: MutableMap<String, String>, val method: ParsingMethod)

/**
 * Main entry point for parsing test files to extract test classes. Uses AST parsing for Java and
 * Kotlin files, falls back to regex parsing.
 */
fun getAllVisibleClassesWithNestedAnnotation(file: File, testTask: Task? = null): ParseResult? {
  val logger = testTask?.logger
  logger?.info("=== Processing test file: ${file.name} at ${Instant.now()} ===")

  val result =
      when {
        file.name.endsWith(".java") -> {
          logger?.info("Attempting Java AST parsing for: ${file.name}")
          try {
            val astResult = parseJavaFileWithAst(file)
            if (astResult != null && astResult.isNotEmpty()) {
              logger?.info(
                  "Java AST parsing successful for: ${file.name}, found ${astResult.size} classes: ${astResult.keys}")
              ParseResult(astResult, ParsingMethod.AST)
            } else {
              logger?.info(
                  "Java AST parsing returned empty/null, falling back to regex for: ${file.name}")
              parseTestClassesWithRegex(file)?.let { ParseResult(it, ParsingMethod.REGEX) }
            }
          } catch (e: Throwable) {
            logger?.warn(
                "Java AST parsing failed for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
            logger?.info("Falling back to regex parsing for: ${file.name}")
            parseTestClassesWithRegex(file)?.let { ParseResult(it, ParsingMethod.REGEX) }
          }
        }
        file.name.endsWith(".kt") -> {
          logger?.info("Attempting Kotlin AST parsing for: ${file.name}")
          try {
            val project = testTask?.project
            val astResult =
                if (project != null) {
                  parseKotlinFileWithReflection(file, project, logger)
                } else {
                  null
                }

            if (astResult != null && astResult.isNotEmpty()) {
              logger?.info(
                  "Kotlin AST parsing successful for: ${file.name}, found ${astResult.size} classes: ${astResult.keys}")
              ParseResult(astResult, ParsingMethod.AST)
            } else {
              logger?.info(
                  "Kotlin AST parsing returned empty/null, falling back to regex for: ${file.name}")
              parseTestClassesWithRegex(file)?.let { ParseResult(it, ParsingMethod.REGEX) }
            }
          } catch (e: Throwable) {
            logger?.warn(
                "Kotlin AST parsing failed for ${file.name}: ${e.javaClass.simpleName} - ${e.message}")
            logger?.info("Falling back to regex parsing for: ${file.name}")
            parseTestClassesWithRegex(file)?.let { ParseResult(it, ParsingMethod.REGEX) }
          }
        }
        else -> {
          logger?.info("Using regex parsing for non-Java/Kotlin file: ${file.name}")
          parseTestClassesWithRegex(file)?.let { ParseResult(it, ParsingMethod.REGEX) }
        }
      }

  logger?.info(
      "Final result for ${file.name}: ${result?.classes?.keys} (${result?.method}) at ${Instant.now()}")
  return result
}
