package dev.nx.maven.buildstate

import com.google.gson.Gson
import dev.nx.maven.shared.BuildState
import org.apache.maven.execution.DefaultMavenExecutionRequest
import org.apache.maven.execution.DefaultMavenExecutionResult
import org.apache.maven.execution.MavenSession
import org.apache.maven.model.Build
import org.apache.maven.model.Model
import org.apache.maven.project.MavenProject
import org.apache.maven.project.MavenProjectHelper
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.eclipse.aether.DefaultRepositorySystemSession
import java.io.File
import java.lang.reflect.Proxy
import java.util.Properties
import kotlin.test.assertEquals

class NxBuildStateApplyMojoTest {

  @TempDir
  lateinit var tempDir: File

  @Test
  fun `bounds restored paths by the Nx workspace root when another POM is selected`() {
    val workspaceRoot = File(tempDir.canonicalFile, "workspace")
    val projectRoot = File(workspaceRoot, "app")
    val sharedResources = File(workspaceRoot, "shared-resources").apply { mkdirs() }
    File(projectRoot, "target").mkdirs()
    File(projectRoot, "target/nx-build-state.json").writeText(
      Gson().toJson(
        BuildState(
          compileSourceRoots = emptySet(),
          testCompileSourceRoots = emptySet(),
          resources = setOf("../shared-resources"),
          mainArtifact = null,
          attachedArtifacts = emptyList()
        )
      )
    )
    val project = MavenProject(Model().apply {
      build = Build().apply { directory = File(projectRoot, "target").path }
    }).apply { file = File(projectRoot, "pom.xml") }

    val request = DefaultMavenExecutionRequest().apply {
      setBaseDirectory(projectRoot)
      systemProperties = Properties().apply { setProperty("env.NX_WORKSPACE_ROOT", workspaceRoot.path) }
    }
    val session = MavenSession(DefaultRepositorySystemSession { false }, request, DefaultMavenExecutionResult()).apply {
      allProjects = listOf(project)
    }
    val projectHelper = Proxy.newProxyInstance(javaClass.classLoader, arrayOf(MavenProjectHelper::class.java)) { _, _, _ ->
      throw UnsupportedOperationException()
    }

    NxBuildStateApplyMojo().apply {
      setField("project", project)
      setField("session", session)
      setField("projectHelper", projectHelper)
      execute()
    }

    assertEquals(listOf(sharedResources.path), project.resources.map { it.directory })
  }

  private fun NxBuildStateApplyMojo.setField(name: String, value: Any) {
    NxBuildStateApplyMojo::class.java.getDeclaredField(name).apply { isAccessible = true }.set(this, value)
  }
}
