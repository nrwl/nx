package dev.nx.gradle

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import org.gradle.testkit.runner.GradleRunner
import org.gradle.testkit.runner.TaskOutcome
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

/**
 * Cross-version regression tests executing the SAME plugin jar (compiled once against the repo's
 * Gradle 8.14.3 wrapper) across Gradle 8.14.3, 9.8.2, and 9.9.1.
 *
 * Covers:
 * - #37858: CachingTaskDependencyResolveContext.getDependencies signature narrowing in Gradle 9.9
 *   (Object -> TaskDependencyContainer) that dropped all inferred task dependsOn.
 * - Direct `nxProjectGraph --configuration-cache` on Gradle 9.9.1 without Task.project or Project
 *   capture failures.
 */
class GradleVersionCompatibilityTest {

  private val gson = Gson()
  private val mapType = object : TypeToken<Map<String, Any?>>() {}.type

  @ParameterizedTest(name = "nxProjectGraph resolves cross-project dependsOn on Gradle {0}")
  @ValueSource(strings = ["8.14.3", "9.8.2", "9.9.1"])
  fun `nxProjectGraph resolves explicit and input-derived cross-project dependsOn`(
      gradleVersion: String,
      @TempDir tempDir: File
  ) {
    val rootDir = createTwoProjectJavaFixture(tempDir)

    val result =
        GradleRunner.create()
            .withGradleVersion(gradleVersion)
            .withProjectDir(rootDir)
            .withPluginClasspath()
            .withArguments(
                "nxProjectGraph",
                "--no-configuration-cache",
                "--rerun-tasks",
                "--info",
                "-PworkspaceRoot=${rootDir.path}",
                "-Phash=compat-$gradleVersion")
            .build()

    assertEquals(TaskOutcome.SUCCESS, result.task(":nxProjectGraph")?.outcome)
    assertEquals(TaskOutcome.SUCCESS, result.task(":a:nxProjectReport")?.outcome)
    assertEquals(TaskOutcome.SUCCESS, result.task(":b:nxProjectReport")?.outcome)
    assertFalse(
        result.output.contains("Safe dependency resolution failed"),
        "Expected zero safe dependency resolution failures on Gradle $gradleVersion, got:\n${result.output}")

    val bReportFile = File(rootDir, "b/build/nx/b.json")
    assertTrue(bReportFile.isFile, "Expected report file at ${bReportFile.path}")
    assertProjectBReport(bReportFile, gradleVersion)

    val aReportFile = File(rootDir, "a/build/nx/a.json")
    assertTrue(aReportFile.isFile, "Expected report file at ${aReportFile.path}")
    val aTargets = readNodeTargets(aReportFile, "a")
    val aJarDependsOn = readDependsOn(aTargets, "jar")
    assertTrue(
        aJarDependsOn.any { it.target == "classes" && it.projects == null },
        "Expected :a:jar to depend on classes on Gradle $gradleVersion, got $aJarDependsOn")
    assertTrue(
        aJarDependsOn.any { it.target == "compileJava" && it.projects == null },
        "Expected :a:jar to depend on compileJava on Gradle $gradleVersion, got $aJarDependsOn")
  }

  @Test
  fun `direct nxProjectGraph succeeds with --configuration-cache on Gradle 9_9_1`(
      @TempDir tempDir: File
  ) {
    val rootDir = createTwoProjectJavaFixture(tempDir)

    // First run from a clean build directory with configuration cache enabled.
    val firstRun =
        GradleRunner.create()
            .withGradleVersion("9.9.1")
            .withProjectDir(rootDir)
            .withPluginClasspath()
            .withArguments(
                "nxProjectGraph",
                "--configuration-cache",
                "--rerun-tasks",
                "-PworkspaceRoot=${rootDir.path}",
                "-Phash=cc-run-1")
            .build()

    assertEquals(TaskOutcome.SUCCESS, firstRun.task(":nxProjectGraph")?.outcome)
    assertEquals(TaskOutcome.SUCCESS, firstRun.task(":a:nxProjectReport")?.outcome)
    assertEquals(TaskOutcome.SUCCESS, firstRun.task(":b:nxProjectReport")?.outcome)

    val printedReportPaths = extractPrintedReportPaths(firstRun.output)
    assertTrue(
        printedReportPaths.isNotEmpty(),
        "Expected nxProjectGraph to print report paths, got:\n${firstRun.output}")
    printedReportPaths.forEach { reportFile ->
      assertTrue(
          reportFile.isFile && reportFile.length() > 0,
          "Expected printed report path to exist and be non-empty: ${reportFile.path}")
    }

    val bReportFile = printedReportPaths.firstOrNull { it.name == "b.json" }
    assertNotNull(bReportFile, "Expected b.json in printed report paths: $printedReportPaths")
    assertProjectBReport(bReportFile!!, "9.9.1 (--configuration-cache run 1)")

    // Delete generated report outputs and re-run without --rerun-tasks to ensure regeneration
    // works cleanly under --configuration-cache rather than hiding behind stale files.
    File(rootDir, "b/build/nx").deleteRecursively()
    assertFalse(bReportFile.exists(), "Expected b.json to be deleted before regeneration")

    val secondRun =
        GradleRunner.create()
            .withGradleVersion("9.9.1")
            .withProjectDir(rootDir)
            .withPluginClasspath()
            .withArguments(
                "nxProjectGraph",
                "--configuration-cache",
                "-PworkspaceRoot=${rootDir.path}",
                "-Phash=cc-run-2")
            .build()

    assertEquals(TaskOutcome.SUCCESS, secondRun.task(":nxProjectGraph")?.outcome)
    assertEquals(TaskOutcome.SUCCESS, secondRun.task(":b:nxProjectReport")?.outcome)

    val secondPrintedPaths = extractPrintedReportPaths(secondRun.output)
    val regeneratedBReport = secondPrintedPaths.firstOrNull { it.name == "b.json" }
    assertNotNull(
        regeneratedBReport,
        "Expected b.json in regenerated printed report paths: $secondPrintedPaths")
    assertTrue(
        regeneratedBReport!!.isFile && regeneratedBReport.length() > 0,
        "Expected regenerated b.json to exist: ${regeneratedBReport.path}")
    assertProjectBReport(regeneratedBReport, "9.9.1 (--configuration-cache run 2)")
  }

  private fun assertProjectBReport(reportFile: File, label: String) {
    val targets = readNodeTargets(reportFile, "b")

    // 1. Input-derived cross-project producer edge from `implementation(project(":a"))`
    val compileJavaDeps = readDependsOn(targets, "compileJava")
    assertTrue(
        compileJavaDeps.any { it.target == "compileJava" && it.projects == listOf(":a") },
        "[$label] Expected :b:compileJava to depend on :a:compileJava, got $compileJavaDeps")
    val compileJavaDependentPatterns = readDependentTaskOutputPatterns(targets, "compileJava")
    assertTrue(
        compileJavaDependentPatterns.contains("**/*.class"),
        "[$label] Expected :b:compileJava dependentTasksOutputFiles to contain **/*.class, got $compileJavaDependentPatterns")
    assertFalse(
        compileJavaDependentPatterns.contains("**/*"),
        "[$label] :b:compileJava must not fall back to **/* catch-all, got $compileJavaDependentPatterns")

    // 2. Explicit string dependencies: qualified cross-project path + local bare task name
    val explicitDeps = readDependsOn(targets, "explicitStringDeps")
    assertTrue(
        explicitDeps.any { it.target == "jar" && it.projects == listOf(":a") },
        "[$label] Expected :b:explicitStringDeps to depend on :a:jar, got $explicitDeps")
    assertTrue(
        explicitDeps.any { it.target == "compileJava" && it.projects == null },
        "[$label] Expected :b:explicitStringDeps to depend on local compileJava, got $explicitDeps")
    val explicitPatterns = readDependentTaskOutputPatterns(targets, "explicitStringDeps")
    assertTrue(
        explicitPatterns.containsAll(setOf("**/*.jar", "**/*.class")),
        "[$label] Expected :b:explicitStringDeps dependentTasksOutputFiles to contain **/*.jar and **/*.class, got $explicitPatterns")
    assertFalse(
        explicitPatterns.contains("**/*"),
        "[$label] :b:explicitStringDeps must not fall back to **/* catch-all, got $explicitPatterns")

    // 3. Input-wired cross-project producer edge (no explicit dependsOn)
    val inputWiredDeps = readDependsOn(targets, "inputWiredDeps")
    assertTrue(
        inputWiredDeps.any { it.target == "jar" && it.projects == listOf(":a") },
        "[$label] Expected :b:inputWiredDeps to depend on :a:jar, got $inputWiredDeps")
    val inputWiredPatterns = readDependentTaskOutputPatterns(targets, "inputWiredDeps")
    assertTrue(
        inputWiredPatterns.contains("**/*.jar"),
        "[$label] Expected :b:inputWiredDeps dependentTasksOutputFiles to contain **/*.jar, got $inputWiredPatterns")
    assertFalse(
        inputWiredPatterns.contains("**/*"),
        "[$label] :b:inputWiredDeps must not fall back to **/* catch-all, got $inputWiredPatterns")

    // 4. Standard Java lifecycle edge
    val assembleDeps = readDependsOn(targets, "assemble")
    assertTrue(
        assembleDeps.any { it.target == "jar" && it.projects == null },
        "[$label] Expected :b:assemble to depend on local jar, got $assembleDeps")
  }

  private fun createTwoProjectJavaFixture(tempDir: File): File {
    val rootDir = tempDir.canonicalFile

    File(rootDir, "settings.gradle.kts")
        .writeText(
            """
            rootProject.name = "compat-fixture"
            include("a", "b")
            """
                .trimIndent())

    File(rootDir, "build.gradle.kts")
        .writeText(
            """
            plugins {
              id("dev.nx.gradle.project-graph")
            }

            allprojects {
              apply(plugin = "dev.nx.gradle.project-graph")
            }
            """
                .trimIndent())

    val aDir = File(rootDir, "a").apply { mkdirs() }
    File(aDir, "build.gradle.kts")
        .writeText(
            """
            plugins {
              `java-library`
            }
            """
                .trimIndent())
    val aSrc = File(aDir, "src/main/java/example").apply { mkdirs() }
    File(aSrc, "Lib.java")
        .writeText(
            """
            package example;
            public class Lib {
              public static String greeting() {
                return "hello";
              }
            }
            """
                .trimIndent())

    val bDir = File(rootDir, "b").apply { mkdirs() }
    File(bDir, "build.gradle.kts")
        .writeText(
            """
            plugins {
              java
            }

            dependencies {
              implementation(project(":a"))
            }

            tasks.register("explicitStringDeps") {
              dependsOn(":a:jar", "compileJava")
              outputs.file(layout.buildDirectory.file("explicit-deps.txt"))
              doLast {
                outputs.files.singleFile.writeText("ok")
              }
            }

            tasks.register("inputWiredDeps") {
              inputs.files(project(":a").tasks.named("jar"))
              outputs.file(layout.buildDirectory.file("input-wired.txt"))
              doLast {
                outputs.files.singleFile.writeText("ok")
              }
            }
            """
                .trimIndent())
    val bSrc = File(bDir, "src/main/java/example").apply { mkdirs() }
    File(bSrc, "App.java")
        .writeText(
            """
            package example;
            public class App {
              public static String run() {
                return Lib.greeting();
              }
            }
            """
                .trimIndent())

    return rootDir
  }

  private data class ParsedDependsOn(val target: String, val projects: List<String>?)

  @Suppress("UNCHECKED_CAST")
  private fun readNodeTargets(reportFile: File, nodeKey: String): Map<String, Map<String, Any?>> {
    val root: Map<String, Any?> = gson.fromJson(reportFile.readText(), mapType)
    val nodes = root["nodes"] as? Map<String, Map<String, Any?>>
    assertNotNull(nodes, "Expected 'nodes' object in ${reportFile.path}")
    val node = nodes!![nodeKey]
    assertNotNull(node, "Expected node '$nodeKey' in ${reportFile.path}, found keys: ${nodes.keys}")
    val targets = node!!["targets"] as? Map<String, Map<String, Any?>>
    assertNotNull(targets, "Expected 'targets' map for node '$nodeKey' in ${reportFile.path}")
    return targets!!
  }

  @Suppress("UNCHECKED_CAST")
  private fun readDependsOn(
      targets: Map<String, Map<String, Any?>>,
      targetName: String
  ): List<ParsedDependsOn> {
    val target = targets[targetName]
    assertNotNull(target, "Expected target '$targetName' in targets: ${targets.keys}")
    val rawList = target!!["dependsOn"] as? List<Map<String, Any?>> ?: return emptyList()
    return rawList.map { entry ->
      ParsedDependsOn(
          target = entry["target"] as String,
          projects = (entry["projects"] as? List<*>)?.map { it.toString() })
    }
  }

  @Suppress("UNCHECKED_CAST")
  private fun readDependentTaskOutputPatterns(
      targets: Map<String, Map<String, Any?>>,
      targetName: String
  ): Set<String> {
    val target = targets[targetName]
    assertNotNull(target, "Expected target '$targetName' in targets: ${targets.keys}")
    val inputs = target!!["inputs"] as? List<Any?> ?: return emptySet()
    return inputs
        .filterIsInstance<Map<*, *>>()
        .mapNotNull { it["dependentTasksOutputFiles"] as? String }
        .toSet()
  }

  private fun extractPrintedReportPaths(output: String): List<File> =
      output
          .lineSequence()
          .map { it.trim() }
          .filter {
            it.endsWith(".json") &&
                it.contains("${File.separator}build${File.separator}nx${File.separator}")
          }
          .map { File(it) }
          .toList()
}
