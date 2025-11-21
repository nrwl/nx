package dev.nx.gradle.utils.parsing

import java.io.File

// Regex patterns for fallback parsing (kept for compatibility and fallback scenarios)
private val classDeclarationRegex =
    Regex(
        """^\s*(?:@\w+\s*)*(?:public|open|sealed|final|enum|annotation)?\s*(class)\s+([A-Za-z_][A-Za-z0-9_]*)""")
private val excludedClassRegex =
    Regex("""^\s*(?:@\w+\s*)*(?:private|internal)\s+class\s+([A-Za-z_][A-Za-z0-9_]*)""")
private val fakeClassRegex =
    Regex(
        """^\s*(?:@\w+\s*)*(?:public\s+|protected\s+|internal\s+|open\s+)*class\s+(Fake[A-Za-z_][A-Za-z0-9_]*)""")
private val abstractClassRegex =
    Regex(
        """^\s*(?:@\w+\s*)*(?:public\s+|protected\s+)?abstract\s+class\s+([A-Za-z_][A-Za-z0-9_]*)""")

/** Fallback to original regex-based parsing when AST parsing fails */
fun parseTestClassesWithRegex(file: File): MutableMap<String, String>? {
  val content = file.takeIf { it.exists() }?.readText() ?: return null

  val lines = content.lines()
  val result = mutableMapOf<String, String>()
  val classStack = mutableListOf<Pair<String, Int>>() // (className, indent)

  var previousLine: String? = null

  for (i in lines.indices) {
    val line = lines[i]
    val trimmed = line.trimStart()
    val indent = line.indexOfFirst { !it.isWhitespace() }.takeIf { it >= 0 } ?: 0

    // Skip private, internal, abstract, and fake classes
    if (excludedClassRegex.containsMatchIn(trimmed)) continue
    if (abstractClassRegex.containsMatchIn(trimmed)) continue
    if (fakeClassRegex.containsMatchIn(trimmed)) continue

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
        result.put(className, className)
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
        result["$parent$className"] = "$parent$$className"
        result.remove(parent) // remove the parent class since child nested class is added
      }

      classStack.add(className to indent)
    }

    previousLine = trimmed
  }

  return result
}
