package dev.nx.maven

import com.google.gson.JsonObject
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class ExternalDependenciesTest {

  @Nested
  inner class BuildExternalNodes {

    @Test
    fun `reads hash from sha1 sidecar file next to artifact`(@TempDir tempDir: File) {
      val jarFile = File(tempDir, "guava-31.1.jar").apply { createNewFile() }
      File(tempDir, "guava-31.1.jar.sha1").writeText("abc123def456")

      val result = buildExternalNodes(listOf(
        analysisWithDeps(tempDir, listOf(
          dep("com.google.guava", "guava", "31.1", jarFile)
        ))
      ))

      val data = result.nodeData("com.google.guava:guava")
      assertEquals("abc123def456", data.get("hash").asString)
      assertEquals("31.1", data.get("version").asString)
    }

    @Test
    fun `falls back to coordinates hash when no sha1 file exists`(@TempDir tempDir: File) {
      val jarFile = File(tempDir, "guava-31.1.jar").apply { createNewFile() }

      val result = buildExternalNodes(listOf(
        analysisWithDeps(tempDir, listOf(
          dep("com.google.guava", "guava", "31.1", jarFile)
        ))
      ))

      val hash = result.nodeData("com.google.guava:guava").get("hash").asString
      // Should be a SHA-1 hex string (40 chars), not null
      assertEquals(40, hash.length)
      assertTrue(hash.matches(Regex("[0-9a-f]+")))
    }

    @Test
    fun `deduplicates same dep across projects and prefers versioned over null`() {
      val analyses = listOf(
        analysisWithDeps(deps = listOf(
          dep("com.example", "lib", null)
        )),
        analysisWithDeps(deps = listOf(
          dep("com.example", "lib", "2.0.0")
        ))
      )

      val result = buildExternalNodes(analyses)

      assertEquals(1, result.size())
      assertEquals("2.0.0", result.nodeData("com.example:lib").get("version").asString)
    }

    @Test
    fun `uses managed as version when version is null`() {
      val result = buildExternalNodes(listOf(
        analysisWithDeps(deps = listOf(dep("org.slf4j", "slf4j-api", null)))
      ))

      assertEquals("managed", result.nodeData("org.slf4j:slf4j-api").get("version").asString)
    }

    @Test
    fun `fallback hash changes when version changes`() {
      val v1 = buildExternalNodes(listOf(
        analysisWithDeps(deps = listOf(dep("com.example", "lib", "1.0.0")))
      ))
      val v2 = buildExternalNodes(listOf(
        analysisWithDeps(deps = listOf(dep("com.example", "lib", "2.0.0")))
      ))

      val hash1 = v1.nodeData("com.example:lib").get("hash").asString
      val hash2 = v2.nodeData("com.example:lib").get("hash").asString
      assertTrue(hash1 != hash2, "Different versions should produce different hashes")
    }

    @Test
    fun `sets correct node structure`() {
      val result = buildExternalNodes(listOf(
        analysisWithDeps(deps = listOf(dep("com.google.guava", "guava", "31.1")))
      ))

      val node = result.getAsJsonObject("maven:com.google.guava:guava")
      assertEquals("maven", node.get("type").asString)
      assertEquals("maven:com.google.guava:guava", node.get("name").asString)

      val data = node.getAsJsonObject("data")
      assertEquals("com.google.guava:guava", data.get("packageName").asString)
      assertEquals("com.google.guava", data.get("groupId").asString)
      assertEquals("guava", data.get("artifactId").asString)
    }
  }

  @Nested
  inner class BuildExternalEdges {

    @Test
    fun `creates edge when dep POM depends on another known external dep`(@TempDir localRepo: File) {
      // guava depends on jsr305 — set up a fake local repo POM
      writePom(localRepo, "com.google.guava", "guava", "31.1", listOf(
        PomDep("com.google.code.findbugs", "jsr305")
      ))

      val deps = listOf(
        dep("com.google.guava", "guava", "31.1"),
        dep("com.google.code.findbugs", "jsr305", "3.0.2")
      )

      val edges = buildExternalEdges(deps, localRepo)

      assertEquals(1, edges.size)
      assertEquals("maven:com.google.guava:guava", edges[0].get("source").asString)
      assertEquals("maven:com.google.code.findbugs:jsr305", edges[0].get("target").asString)
      assertEquals("static", edges[0].get("type").asString)
    }

    @Test
    fun `ignores deps in POM that are not in our external node set`(@TempDir localRepo: File) {
      // guava depends on checker-qual, but checker-qual is NOT in our external deps
      writePom(localRepo, "com.google.guava", "guava", "31.1", listOf(
        PomDep("org.checkerframework", "checker-qual")
      ))

      val deps = listOf(
        dep("com.google.guava", "guava", "31.1")
      )

      val edges = buildExternalEdges(deps, localRepo)

      assertTrue(edges.isEmpty())
    }

    @Test
    fun `skips deps with null version`(@TempDir localRepo: File) {
      val deps = listOf(
        dep("com.google.guava", "guava", null)
      )

      val edges = buildExternalEdges(deps, localRepo)

      assertTrue(edges.isEmpty())
    }

    @Test
    fun `skips deps when POM file does not exist`(@TempDir localRepo: File) {
      // No POM written to localRepo
      val deps = listOf(
        dep("com.google.guava", "guava", "31.1"),
        dep("com.google.code.findbugs", "jsr305", "3.0.2")
      )

      val edges = buildExternalEdges(deps, localRepo)

      assertTrue(edges.isEmpty())
    }

    @Test
    fun `handles malformed POM gracefully`(@TempDir localRepo: File) {
      // Write an invalid POM
      val pomDir = File(localRepo, "com/google/guava/guava/31.1")
      pomDir.mkdirs()
      File(pomDir, "guava-31.1.pom").writeText("this is not valid xml")

      val deps = listOf(
        dep("com.google.guava", "guava", "31.1"),
        dep("com.google.code.findbugs", "jsr305", "3.0.2")
      )

      val edges = buildExternalEdges(deps, localRepo)

      // Should not throw, just return no edges
      assertTrue(edges.isEmpty())
    }

    @Test
    fun `deduplicates same dep appearing from multiple projects`(@TempDir localRepo: File) {
      writePom(localRepo, "com.google.guava", "guava", "31.1", listOf(
        PomDep("com.google.code.findbugs", "jsr305")
      ))

      // Same dep listed twice (as if from two different projects)
      val deps = listOf(
        dep("com.google.guava", "guava", "31.1"),
        dep("com.google.guava", "guava", "31.1"),
        dep("com.google.code.findbugs", "jsr305", "3.0.2")
      )

      val edges = buildExternalEdges(deps, localRepo)

      // Should only produce one edge, not two
      assertEquals(1, edges.size)
    }

    @Test
    fun `creates multiple edges for dep with multiple known transitive deps`(@TempDir localRepo: File) {
      writePom(localRepo, "org.springframework", "spring-core", "6.0.0", listOf(
        PomDep("org.springframework", "spring-jcl"),
        PomDep("io.micrometer", "micrometer-core"),
        PomDep("some.unknown", "not-in-our-set")  // should be ignored
      ))

      val deps = listOf(
        dep("org.springframework", "spring-core", "6.0.0"),
        dep("org.springframework", "spring-jcl", "6.0.0"),
        dep("io.micrometer", "micrometer-core", "1.10.0")
      )

      val edges = buildExternalEdges(deps, localRepo)

      assertEquals(2, edges.size)
      val targets = edges.map { it.get("target").asString }.toSet()
      assertTrue(targets.contains("maven:org.springframework:spring-jcl"))
      assertTrue(targets.contains("maven:io.micrometer:micrometer-core"))
    }
  }

  // --- Helpers ---

  private data class PomDep(val groupId: String, val artifactId: String)

  private fun dep(
    groupId: String, artifactId: String, version: String?,
    artifactFile: File? = null
  ) = ExternalMavenDependency(groupId, artifactId, version, "compile", artifactFile)

  private fun analysisWithDeps(
    pomDir: File = File("/tmp"),
    deps: List<ExternalMavenDependency>
  ) = ProjectAnalysis(
    pomFile = File(pomDir, "pom.xml").apply { if (!exists()) createNewFile() },
    root = "project",
    project = JsonObject(),
    dependencies = emptyList(),
    externalDependencies = deps
  )

  /** Shorthand to get a node's data object by coordinates */
  private fun JsonObject.nodeData(coordinates: String): JsonObject =
    getAsJsonObject("maven:$coordinates").getAsJsonObject("data")

  /** Write a minimal POM to the local repo directory structure */
  private fun writePom(
    localRepo: File, groupId: String, artifactId: String,
    version: String, deps: List<PomDep>
  ) {
    val pomDir = File(localRepo, "${groupId.replace('.', '/')}/$artifactId/$version")
    pomDir.mkdirs()

    val depsXml = deps.joinToString("\n") { d ->
      "<dependency><groupId>${d.groupId}</groupId><artifactId>${d.artifactId}</artifactId></dependency>"
    }

    val xml = buildString {
      appendLine("""<?xml version="1.0" encoding="UTF-8"?>""")
      appendLine("<project>")
      appendLine("  <modelVersion>4.0.0</modelVersion>")
      appendLine("  <groupId>$groupId</groupId>")
      appendLine("  <artifactId>$artifactId</artifactId>")
      appendLine("  <version>$version</version>")
      appendLine("  <dependencies>$depsXml</dependencies>")
      appendLine("</project>")
    }

    File(pomDir, "$artifactId-$version.pom").writeText(xml)
  }
}
