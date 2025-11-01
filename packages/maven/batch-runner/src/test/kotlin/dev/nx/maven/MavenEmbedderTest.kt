package dev.nx.maven

import org.apache.maven.api.cli.ExecutorRequest
import org.apache.maven.cling.executor.embedded.EmbeddedMavenExecutor
import org.junit.jupiter.api.Test
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths

/**
 * Demonstration of Maven 4.x EmbeddedMavenExecutor API for batch task execution.
 *
 * The EmbeddedMavenExecutor is designed for executing multiple Maven tasks efficiently:
 * - Context caching: ClassLoaders are cached per Maven installation, no reload overhead
 * - Single instance reused: Same executor handles multiple invocations
 * - Automatic cleanup: Runtime-created class realms disposed automatically
 * - State restoration: System properties and streams restored after each execution
 * - In-process execution: No subprocess spawning, direct Java method calls
 *
 * This is significantly more efficient than Maven Invoker which spawns a subprocess
 * per task (~100-500ms overhead per task).
 */
class MavenEmbedderTest {
  private val workspaceRoot = File(System.getProperty("user.home"), "projects/nx4")

  @Test
  fun `demonstrate embedded executor context caching across multiple invocations`() {

    // Initialize EmbeddedMavenExecutor ONCE with context caching enabled (true, true)
    // This is the key to performance: the executor reuses loaded classloaders
    val executor = EmbeddedMavenExecutor(true, true)

    try {
      println("\n=== Demonstrating EmbeddedMavenExecutor Context Caching ===\n")

      // Set maven.home system property for ExecutorRequest discovery

      // Execute the same goal 3 times using the SAME executor instance
      // With context caching enabled, the Maven classloader is loaded once and reused
      repeat(3) { iteration ->
        val output = ByteArrayOutputStream()

        println("Iteration ${iteration + 1}: Building ExecutorRequest...")

        System.setProperty("maven.home", "/home/jason/.local/share/mise/installs/maven/3.9.11/apache-maven-3.9.11")
        // ExecutorRequest uses a fluent builder API
        val request = ExecutorRequest.mavenBuilder(null)
          .arguments(listOf("--version"))  // Simple goal that always succeeds
          .cwd(workspaceRoot.toPath())
          .stdOut(output)
          .stdErr(System.err)
          .build()

        println("Iteration ${iteration + 1}: Executing Maven goal...")
        val startTime = System.currentTimeMillis()

        // This reuses the cached context from previous iterations
        // First invocation loads classloader (~500ms), subsequent ones are ~10-50ms
        val exitCode = executor.execute(request)

        val duration = System.currentTimeMillis() - startTime
        println("Iteration ${iteration + 1}: Exit code=$exitCode, Duration=${duration}ms")
        println("Iteration ${iteration + 1}: Output: ${output.toString().take(100)}\n")

        assert(exitCode == 0) { "Maven execution failed with exit code $exitCode" }
      }

      println("=== All iterations completed successfully ===")
      println("Notice how subsequent invocations are faster due to context caching!\n")
    } finally {
      println("Closing EmbeddedMavenExecutor (cleaning up cached contexts and class realms)...")
      executor.close()
      println("Cleanup complete - all Maven classloaders and realms disposed.\n")
    }
  }

  @Test
  fun `measure overhead of multiple separate invocations vs single combined invocation`() {
    val executor = EmbeddedMavenExecutor(true, true)

    try {
      println("\n=== Measuring POM Parse Overhead: Multiple vs Combined Invocations ===\n")

      // Use some real modules from the workspace for realistic testing
      val modules = listOf(
        "dev.nx.maven:nx-maven-plugin",
        "dev.nx.maven:batch-runner"
      )


      System.setProperty("maven.home", "/home/jason/.local/share/mise/installs/maven/3.9.11/apache-maven-3.9.11")

      val modulesArg0 = modules.joinToString(",")
      val request0 = ExecutorRequest.mavenBuilder(null)
        .arguments(listOf("nx:apply", "-pl", modulesArg0))
        .cwd(workspaceRoot.toPath())
        .stdOut(ByteArrayOutputStream())
        .stdErr(ByteArrayOutputStream())
        .build()

      val exitCode0 = executor.execute(request0)

      // Test 1: Multiple separate invocations (each parses POMs)
      println("Test 1: Running ${modules.size} modules in SEPARATE invocations...")
      val separateStart = System.currentTimeMillis()
      var separateTotalTime = 0L

      modules.forEach { module ->
        val output = ByteArrayOutputStream()
        System.setProperty("maven.home", "/home/jason/.local/share/mise/installs/maven/3.9.11/apache-maven-3.9.11")

        val request = ExecutorRequest.mavenBuilder(null)
          .arguments(listOf("nx:apply", "-pl", module))
          .cwd(workspaceRoot.toPath())
          .stdOut(output)
          .stdErr(ByteArrayOutputStream())
          .build()

        val iterStart = System.currentTimeMillis()
        val exitCode = executor.execute(request)
        val iterDuration = System.currentTimeMillis() - iterStart
        separateTotalTime += iterDuration

        println("  Module '$module': ${iterDuration}ms (exit code: $exitCode)")
//        assert(exitCode == 0) { "Maven execution failed for module $module" }
      }

      val separateDuration = System.currentTimeMillis() - separateStart
      println("Total time (separate invocations): ${separateDuration}ms\n")

      // Test 2: Single combined invocation (parses POMs once)
      println("Test 2: Running ${modules.size} modules in SINGLE combined invocation...")
      val combinedStart = System.currentTimeMillis()

      val output = ByteArrayOutputStream()
      System.setProperty("maven.home", "/home/jason/.local/share/mise/installs/maven/3.9.11/apache-maven-3.9.11")

      val modulesArg = modules.joinToString(",")
      val request = ExecutorRequest.mavenBuilder(null)
        .arguments(listOf("nx:apply", "-pl", modulesArg))
        .cwd(workspaceRoot.toPath())
        .stdOut(output)
        .stdErr(ByteArrayOutputStream())
        .build()

      val exitCode = executor.execute(request)
      val combinedDuration = System.currentTimeMillis() - combinedStart

      println("  Combined (modules: $modulesArg): ${combinedDuration}ms (exit code: $exitCode)")
      assert(exitCode == 0) { "Maven execution failed for combined invocation" }

      // Calculate overhead
      val overhead = separateDuration - combinedDuration
      val overheadPercent = if (separateDuration > 0) (overhead.toDouble() / separateDuration * 100).toInt() else 0

      println("\n=== Results ===")
      println("Separate invocations: ${separateDuration}ms")
      println("Combined invocation:  ${combinedDuration}ms")
      println("Overhead:             ${overhead}ms (${overheadPercent}%)")
      println("\nConclusion: ${if (overhead > 0) "Combining saves ${overhead}ms per batch" else "No significant difference"}\n")

    } finally {
      executor.close()
    }
  }

  private fun resolveMavenHome(): String {
    // Strategy 1: Check for mvnw wrapper in workspace (preferred - ensures correct Maven version)
    val mvnw = File(workspaceRoot, "mvnw")
    val mvnwDir = File(workspaceRoot, ".mvn")
    val mvnwWrapperDir = File(workspaceRoot, ".mvn/wrapper")

    if (mvnw.exists() && mvnwDir.exists()) {
      println("Found mvnw wrapper in workspace at: ${workspaceRoot.absolutePath}")

      // Look for downloaded Maven in .mvn/wrapper/maven-*/
      if (mvnwWrapperDir.exists()) {
        mvnwWrapperDir.listFiles()?.forEach { dir ->
          if (dir.name.startsWith("maven-") && dir.isDirectory) {
            println("Found Maven in mvnw wrapper cache: ${dir.absolutePath}")
            return dir.absolutePath
          }
        }
      }

      // If Maven not yet downloaded by wrapper, continue to next strategy
      // EmbeddedMavenExecutor needs a real Maven installation, not the workspace root
      println("mvnw wrapper found but Maven not yet downloaded; checking other strategies...")
    }

    // Strategy 2: Check "which mvn" and go up 2 directories to find Maven home
    try {
      val process = ProcessBuilder("which", "mvn").start()
      val mvnPath = process.inputStream.bufferedReader().use { it.readText().trim() }
      if (mvnPath.isNotEmpty()) {
        val mvnFile = File(mvnPath).canonicalFile
        val mavenHome = mvnFile.parentFile.parentFile.absolutePath
        val mavenPath = Paths.get(mavenHome)
        if (Files.isDirectory(mavenPath)) {
          println("Found Maven via 'which mvn': $mavenHome")
          return mavenHome
        }
      }
    } catch (e: Exception) {
      // "which" command not available or mvn not in PATH
    }

    // Strategy 3: Check MAVEN_HOME environment variable
    val mavenHomeEnv = System.getenv("MAVEN_HOME")
    if (mavenHomeEnv != null) {
      val mavenPath = Paths.get(mavenHomeEnv)
      if (Files.isDirectory(mavenPath)) {
        println("Using MAVEN_HOME: $mavenHomeEnv")
        return mavenHomeEnv
      } else {
        println("MAVEN_HOME points to non-existent directory: $mavenHomeEnv")
      }
    }

    // Strategy 4: Check maven.home system property (set by Maven itself)
    val mavenHomeProp = System.getProperty("maven.home")
    if (mavenHomeProp != null) {
      val mavenPath = Paths.get(mavenHomeProp)
      if (Files.isDirectory(mavenPath)) {
        println("Using maven.home system property: $mavenHomeProp")
        return mavenHomeProp
      }
    }

    // Strategy 5: Check common installation locations
    val userHome = System.getProperty("user.home")
    val commonLocations = mutableListOf(
      "/usr/local/maven",
      "/opt/maven",
      "/usr/share/maven",
      "$userHome/.m2/mvn",
      "$userHome/.local/share/mise/installs/maven"  // mise version manager
    )

    // Also check for mise managed Maven installations
    val miseDir = File(userHome, ".local/share/mise/installs/maven")
    if (miseDir.exists()) {
      miseDir.listFiles()?.sortedByDescending { it.name }?.forEach { versionDir ->
        versionDir.listFiles()?.forEach { possibleMaven ->
          if (possibleMaven.name.startsWith("apache-maven-") && possibleMaven.isDirectory) {
            commonLocations.add(possibleMaven.absolutePath)
          }
        }
      }
    }

    for (location in commonLocations) {
      val mavenPath = Paths.get(location)
      if (Files.isDirectory(mavenPath)) {
        println("Found Maven at: $location")
        return location
      }
    }

    // If all strategies fail, provide helpful error message
    throw IllegalStateException(
      """
      Could not find Maven installation. Please do one of the following:

      Option 1 (Recommended): Use mvnw wrapper from workspace
        - Ensure mvnw and .mvn/ exist in workspace: ${workspaceRoot.absolutePath}

      Option 2: Set MAVEN_HOME environment variable
        export MAVEN_HOME=/path/to/maven/4.0.0-rc-4

      Option 3: Install Maven in one of these common locations:
        - /usr/local/maven
        - /opt/maven
        - /usr/share/maven
        - ~/.m2/mvn
        - Use 'mise' version manager: mise install maven@4.0.0-rc-4

      Current status:
        - mvnw found: ${mvnw.exists()}
        - .mvn directory found: ${mvnwDir.exists()}
        - MAVEN_HOME: ${System.getenv("MAVEN_HOME") ?: "not set"}
        - Workspace root: ${workspaceRoot.absolutePath}
      """.trimIndent()
    )
  }
}
