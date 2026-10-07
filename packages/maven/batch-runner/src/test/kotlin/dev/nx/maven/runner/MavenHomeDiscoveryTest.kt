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

  @Test
  fun `prefers the wrapper's Maven over MAVEN_HOME`() {
    val wrapperHome = mavenHome("wrapper-maven", "4.0.0")
    val globalHome = mavenHome("global-maven", "3.9.11")
    val workspace = workspaceWithMvnw(wrapperHome, "4.0.0-rc-7")

    val result = MavenHomeDiscovery(workspace, tempDir.absolutePath) { name ->
      if (name == "MAVEN_HOME") globalHome.absolutePath else null
    }.discoverMavenHomeWithVersion()

    assertEquals(wrapperHome.absolutePath, result?.mavenHome?.absolutePath)
    assertEquals("4.0.0-rc-7", result?.version)
  }

  @Test
  fun `uses MAVEN_HOME when the workspace has no wrapper`() {
    val globalHome = mavenHome("global-maven", "3.9.11")
    val workspace = File(tempDir, "workspace").apply { mkdirs() }

    val result = MavenHomeDiscovery(workspace, tempDir.absolutePath) { name ->
      if (name == "MAVEN_HOME") globalHome.absolutePath else null
    }.discoverMavenHomeWithVersion()

    assertEquals(globalHome.absolutePath, result?.mavenHome?.absolutePath)
  }
}
