package dev.nx.maven.runner

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertEquals

class MavenHomeDiscoveryTest {
  @TempDir
  lateinit var tempDir: File

  private fun mavenHome(name: String, version: String): File =
    File(tempDir, name).apply {
      File(this, "lib").mkdirs()
      File(this, "lib/maven-core-$version.jar").createNewFile()
    }

  private fun workspaceWithMvnw(home: File, version: String): File =
    File(tempDir, "workspace").apply {
      mkdirs()
      File(this, "mvnw").apply {
        writeText("#!/bin/sh\necho 'Apache Maven $version'\necho 'Maven home: ${home.absolutePath}'\n")
        setExecutable(true)
      }
    }

  private fun discover(
    workspace: File,
    env: Map<String, String> = emptyMap(),
    properties: Map<String, String> = emptyMap()
  ): MavenDiscoveryResult? =
    MavenHomeDiscovery(workspace, tempDir.absolutePath, { env[it] }, { properties[it] })
      .discoverMavenHomeWithVersion()

  @Test
  fun `prefers the wrapper's Maven over MAVEN_HOME`() {
    val wrapperHome = mavenHome("wrapper-maven", "4.0.0")
    val globalHome = mavenHome("global-maven", "3.9.11")
    val workspace = workspaceWithMvnw(wrapperHome, "4.0.0-rc-7")

    val result = discover(workspace, env = mapOf("MAVEN_HOME" to globalHome.absolutePath))

    assertEquals(wrapperHome.absolutePath, result?.mavenHome?.absolutePath)
    assertEquals("4.0.0-rc-7", result?.version)
  }

  @Test
  fun `prefers the wrapper's Maven over the maven home property`() {
    val wrapperHome = mavenHome("wrapper-maven", "4.0.0")
    val propertyHome = mavenHome("property-maven", "3.9.11")
    val workspace = workspaceWithMvnw(wrapperHome, "4.0.0-rc-7")

    val result = discover(workspace, properties = mapOf("maven.home" to propertyHome.absolutePath))

    assertEquals(wrapperHome.absolutePath, result?.mavenHome?.absolutePath)
  }

  @Test
  fun `uses MAVEN_HOME when the workspace has no wrapper`() {
    val globalHome = mavenHome("global-maven", "3.9.11")
    val workspace = File(tempDir, "workspace").apply { mkdirs() }

    val result = discover(workspace, env = mapOf("MAVEN_HOME" to globalHome.absolutePath))

    assertEquals(globalHome.absolutePath, result?.mavenHome?.absolutePath)
  }
}
