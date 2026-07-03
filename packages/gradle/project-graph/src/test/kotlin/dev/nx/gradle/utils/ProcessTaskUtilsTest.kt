package dev.nx.gradle.utils

import dev.nx.gradle.data.Dependency
import dev.nx.gradle.data.DependsOnEntry
import dev.nx.gradle.data.ExternalNode
import kotlin.io.path.Path
import org.gradle.api.Project
import org.gradle.testfixtures.ProjectBuilder
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

class ProcessTaskUtilsTest {

  private val project = ProjectBuilder.builder().build()
  private val logger = project.logger

  @BeforeEach
  fun clearCache() {
    // Clear the thread-local cache to prevent interference between tests
    taskDependencyCache.get().clear()
  }

  @Test
  fun `test replaceRootInPath`() {
    val path = Path("home", "user", "workspace", "project", "src", "main", "java").toString()
    val projectRoot = Path("home", "user", "workspace", "project").toString()
    val workspaceRoot = Path("home", "user", "workspace").toString()

    assertEquals(
        Path("{projectRoot}", "src", "main", "java").toString(),
        replaceRootInPath(path, projectRoot, workspaceRoot))
    assertEquals(
        Path("{workspaceRoot}", "project", "src", "main", "java").toString(),
        replaceRootInPath(path, Path("other", "path").toString(), workspaceRoot))
    assertNull(replaceRootInPath(Path("external", "other").toString(), projectRoot, workspaceRoot))
  }

  @Test
  fun `test getGradlewCommand`() {
    val command = getGradlewCommand()
    assertTrue(command.contains("gradlew"))
  }

  @Test
  fun `test getMetadata`() {
    val metadata = getMetadata("Compile Java", ":project", "compileJava")
    assertEquals("Compile Java", metadata["description"])
    assertEquals("gradle", (metadata["technologies"] as Array<*>)[0])
  }

  @Test
  fun `test getExternalDepFromInputFile valid path`() {
    val externalNodes = mutableMapOf<String, ExternalNode>()
    val path = "org/apache/commons/commons-lang3/3.13.0/hash/commons-lang3-3.13.0.jar"

    val key = getExternalDepFromInputFile(path, externalNodes, logger)

    assertEquals("gradle:commons-lang3-3.13.0", key)
    assertTrue(externalNodes.containsKey("gradle:commons-lang3-3.13.0"))
  }

  @Test
  fun `test getExternalDepFromInputFile invalid path`() {
    val externalNodes = mutableMapOf<String, ExternalNode>()
    val key = getExternalDepFromInputFile("invalid/path.jar", externalNodes, logger)

    assertNull(key)
    assertTrue(externalNodes.isEmpty())
  }

  @Test
  fun `test getDependsOnForTask with direct dependsOn same project returns null`() {
    val project = ProjectBuilder.builder().withName("myApp").build()
    // Create a build file so the task dependencies are properly detected
    val buildFile = java.io.File(project.projectDir, "build.gradle")
    buildFile.writeText("// test build file")

    val taskA = project.tasks.register("taskA").get()
    val taskB = project.tasks.register("taskB").get()

    taskA.dependsOn(taskB)

    val dependencies = mutableSetOf<Dependency>()
    val dependsOn = getDependsOnForTask(null, taskA, dependencies)

    // Same-project dependencies use object format without projects field
    assertNotNull(dependsOn, "Same-project dependsOn should be present")
    assertEquals(1, dependsOn!!.size)
    assertEquals("taskB", dependsOn[0].target)
    assertNull(dependsOn[0].projects, "Same-project deps should not have projects field")
  }

  @Test
  fun `test processTask basic properties`() {
    val project = ProjectBuilder.builder().build()
    val task = project.tasks.register("compileJava").get()
    task.group = "build"
    task.description = "Compiles Java source files"

    val gitIgnoreClassifier = GitIgnoreClassifier(project.rootDir)
    val result =
        processTask(
            task,
            projectBuildPath = ":project",
            projectRoot = project.projectDir.path,
            workspaceRoot = project.rootDir.path,
            externalNodes = mutableMapOf(),
            dependencies = mutableSetOf(),
            targetNameOverrides = emptyMap(),
            gitIgnoreClassifier = gitIgnoreClassifier,
            project = project)

    assertEquals(true, result["cache"])
    assertEquals(result["executor"], "@nx/gradle:gradle")
    assertNotNull(result["metadata"])
    assertNotNull(result["options"])
  }

  @Test
  fun `publishToMavenLocal tasks are not cacheable`() {
    val project = ProjectBuilder.builder().build()
    assertFalse(
        isCacheable(project.tasks.register("publishPluginMavenPublicationToMavenLocal").get()))
    assertFalse(isCacheable(project.tasks.register("publishToMavenLocal").get()))
    assertTrue(isCacheable(project.tasks.register("compileJava").get()))
  }

  @Nested
  inner class GetInputsForTaskTests {
    lateinit var project: Project
    lateinit var workspaceRoot: String
    lateinit var projectRoot: String

    @BeforeEach
    fun projectSetup() {
      project = ProjectBuilder.builder().build()
      workspaceRoot = project.rootDir.path
      projectRoot = project.projectDir.path

      val gitIgnore = java.io.File(workspaceRoot, ".gitignore")
      // Any inputs of tasks that are found in ignored files are considered dependent task output
      // files
      gitIgnore.writeText("dist")
    }

    @Test
    fun `test getInputsForTask with dependsOn outputs exclusion`() {
      // Create dependent task with outputs
      val dependentTask = project.tasks.register("dependentTask").get()
      val outputFile = java.io.File("$workspaceRoot/dist/output.jar")
      dependentTask.outputs.file(outputFile)

      // Create main task with inputs and dependsOn
      val mainTask = project.tasks.register("mainTask").get()
      mainTask.dependsOn(dependentTask)

      // Add inputs - one that matches dependent output, one that doesn't
      val inputFile1 = java.io.File("$workspaceRoot/dist/output.jar") // Should be excluded
      val inputFile2 = java.io.File("$workspaceRoot/src/main.kt") // Should be included
      mainTask.inputs.files(inputFile1, inputFile2)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null, mainTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

      assertNotNull(result)

      // Should contain consolidated dependentTasksOutputFiles glob pattern for jar extension
      assertTrue(
          result!!.any {
            it is Map<*, *> &&
                it["dependentTasksOutputFiles"] == "**/*.jar" &&
                it["transitive"] == true
          })

      // Should contain the non-conflicting input file
      assertTrue(result.any { it == Path("{projectRoot}", "src", "main.kt").toString() })
    }

    @Test
    fun `test getInputsForTask consolidates by extension`() {
      val dependentTask = project.tasks.register("dependentTask").get()

      // Add file outputs with different extensions
      val jarFile = java.io.File("$workspaceRoot/dist/app.jar")
      val classFile = java.io.File("$workspaceRoot/dist/classes/Main.class")
      dependentTask.outputs.file(jarFile)
      dependentTask.outputs.file(classFile)

      val mainTask = project.tasks.register("mainTask").get()
      mainTask.dependsOn(dependentTask)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null, mainTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

      assertNotNull(result)

      // Should have consolidated glob patterns by extension
      assertTrue(
          result!!.any {
            it is Map<*, *> &&
                it["dependentTasksOutputFiles"] == "**/*.jar" &&
                it["transitive"] == true
          })
      assertTrue(
          result.any {
            it is Map<*, *> &&
                it["dependentTasksOutputFiles"] == "**/*.class" &&
                it["transitive"] == true
          })

      // Should only have 2 dependentTasksOutputFiles entries (one per extension)
      val dependentTasksOutputFilesCount =
          result.count { it is Map<*, *> && it.containsKey("dependentTasksOutputFiles") }
      assertEquals(2, dependentTasksOutputFilesCount)
    }

    @Test
    fun `test getInputsForTask characterizes deps by declared output deterministically`() {
      // An archive dependent has a FILE output, so its extension is derivable (a precise glob).
      val jarProducer =
          project.tasks.register("jarProducer", org.gradle.api.tasks.bundling.Jar::class.java).get()
      jarProducer.archiveExtension.set("jar")

      // A Copy dependent has a DIRECTORY output. A consumer reads that whole output directory,
      // whose
      // contents the model cannot enumerate, so the dependency is characterized by the "**/*"
      // catch-all rather than by its sources. Characterizing by sources would miss committed files
      // that enter through a directory source (the nx-api application.conf case).
      val copyDep =
          project.tasks.register("copyBundled", org.gradle.api.tasks.Copy::class.java).get()
      copyDep.from(java.io.File("$workspaceRoot/dist/bundle.tar.gz"))
      copyDep.into(java.io.File("$workspaceRoot/build/bundled"))

      val consumer = project.tasks.register("consumerDeterministic").get()
      consumer.dependsOn(jarProducer, copyDep)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))

      fun outputFileGlobs(): Set<String> =
          getInputsForTask(
                  null, consumer, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)
              ?.filterIsInstance<Map<*, *>>()
              ?.mapNotNull { it["dependentTasksOutputFiles"] as? String }
              ?.toSet() ?: emptySet()

      // Clean tree: no artifact files on disk.
      val clean = outputFileGlobs()

      // Built tree: create the generated source and jar output on disk (transient build state).
      java.io.File("$workspaceRoot/dist").mkdirs()
      java.io.File("$workspaceRoot/dist/bundle.tar.gz").writeText("x")
      java.io.File("$workspaceRoot/build/libs").mkdirs()
      java.io.File("$workspaceRoot/build/libs/app.jar").writeText("x")
      val built = outputFileGlobs()

      // The derivation must be a pure function of the task model, not of on-disk build state.
      assertEquals(
          clean,
          built,
          "dependentTasksOutputFiles must not change between a clean and a built tree")

      // Archive (file output) -> precise extension. Copy (directory output) -> catch-all.
      assertTrue(clean.contains("**/*.jar"), "Expected jar from archiveExtension, got $clean")
      assertTrue(
          clean.contains("**/*"),
          "Expected the catch-all for a Copy dependency's directory output, got $clean")
      assertFalse(
          clean.contains("**/*.gz"),
          "A Copy dependency is characterized by its output, not its sources, got $clean")
    }

    @Test
    fun `test getInputsForTask falls back to catch-all for uncharacterizable directory output`() {
      // An opaque dependency that declares only an @OutputDirectory (no type/archive/file-output we
      // can reduce to extensions) triggers a conservative "**/*" so its directory is still hashed.
      val opaqueDep = project.tasks.register("opaqueDep").get()
      opaqueDep.outputs.dir(java.io.File("$workspaceRoot/build/opaque"))

      val consumer = project.tasks.register("consumerOpaque").get()
      consumer.dependsOn(opaqueDep)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))

      fun outputFileGlobs(): Set<String> =
          getInputsForTask(
                  null, consumer, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)
              ?.filterIsInstance<Map<*, *>>()
              ?.mapNotNull { it["dependentTasksOutputFiles"] as? String }
              ?.toSet() ?: emptySet()

      val clean = outputFileGlobs()
      java.io.File("$workspaceRoot/build/opaque").mkdirs()
      java.io.File("$workspaceRoot/build/opaque/thing.dat").writeText("x")
      val built = outputFileGlobs()

      assertEquals(clean, built, "catch-all must be deterministic across clean and built trees")
      assertTrue(
          clean.contains("**/*"), "Expected catch-all for an opaque directory output, got $clean")
    }

    @Test
    fun `test getInputsForTask over-declares catch-all when a dependency output read fails`() {
      // A TaskOutputs implementing only the public interface makes the reflective
      // getFileProperties() read throw; the dependency must over-declare "**/*".
      val realDep = project.tasks.register("failingDep").get()
      val fakeDep =
          object : org.gradle.api.Task by realDep {
            override fun getOutputs(): org.gradle.api.tasks.TaskOutputs =
                object : org.gradle.api.tasks.TaskOutputs by realDep.outputs {}
          }
      val consumer = project.tasks.register("consumerFailingDep").get()
      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))

      val globs =
          getInputsForTask(
                  setOf(fakeDep),
                  consumer,
                  projectRoot,
                  workspaceRoot,
                  mutableMapOf(),
                  gitIgnoreClassifier)
              ?.filterIsInstance<Map<*, *>>()
              ?.mapNotNull { it["dependentTasksOutputFiles"] as? String }
              ?.toSet() ?: emptySet()

      assertTrue(
          globs.contains("**/*"),
          "A dependency whose output model can't be read must over-declare **/*, got $globs")
    }

    @Test
    fun `test getInputsForTask falls back to catch-all for a fileTree-only Copy dependency`() {
      // A Copy whose only source is a FileTree yields no characterizable extensions, but its
      // destination @OutputDirectory triggers the catch-all. FileTree contents are never
      // enumerated.
      val treeDir = java.io.File("$workspaceRoot/dist/tree").apply { mkdirs() }
      java.io.File(treeDir, "a.dat").writeText("x")
      val copyDep = project.tasks.register("copyTree", org.gradle.api.tasks.Copy::class.java).get()
      copyDep.from(project.fileTree(treeDir))
      copyDep.into(java.io.File("$workspaceRoot/build/tree-out"))

      val consumer = project.tasks.register("consumerTree").get()
      consumer.dependsOn(copyDep)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))

      fun outputFileGlobs(): Set<String> =
          getInputsForTask(
                  null, consumer, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)
              ?.filterIsInstance<Map<*, *>>()
              ?.mapNotNull { it["dependentTasksOutputFiles"] as? String }
              ?.toSet() ?: emptySet()

      val clean = outputFileGlobs()
      java.io.File(treeDir, "b.json").writeText("{}")
      val built = outputFileGlobs()

      assertEquals(clean, built, "catch-all must be deterministic across clean and built trees")
      assertTrue(
          clean.contains("**/*"),
          "fileTree-only Copy dependency should yield the catch-all, got $clean")
      assertFalse(
          clean.contains("**/*.dat"), "FileTree contents must not be enumerated, got $clean")
      assertFalse(
          clean.contains("**/*.json"), "FileTree contents must not be enumerated, got $clean")
    }

    @Test
    fun `test getInputsForTask does not use catch-all for a typed compile dependency`() {
      project.plugins.apply("java")
      val compileJava = project.tasks.getByName("compileJava")

      val consumer = project.tasks.register("consumerCompile").get()
      consumer.dependsOn(compileJava)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null, consumer, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)
      val globs =
          result
              ?.filterIsInstance<Map<*, *>>()
              ?.mapNotNull { it["dependentTasksOutputFiles"] as? String }
              ?.toSet() ?: emptySet()

      // Typed compile task (directory output, but typed) yields a specific class glob, not "**/*".
      assertTrue(globs.contains("**/*.class"), "Expected class from JavaCompile, got $globs")
      assertFalse(
          globs.contains("**/*"),
          "Typed compile dependency must not trigger the catch-all, got $globs")
    }

    @Test
    fun `test getInputsForTask Copy task itself derives generated sources but not checked-in or FileTree`() {
      // A Copy/Sync task, characterized as the CONSUMING task ITSELF, contributes the extensions of
      // its declared concrete-file sources to its OWN inputs (taskOwnPatterns). Only GENERATED
      // (gitignored) sources need a dependentTasksOutputFiles glob; checked-in sources are already
      // captured as direct inputs, and FileTree/directory sources must never be enumerated.
      // Extensions are derived without the files existing on disk. (As a DEPENDENCY the same Copy
      // is
      // characterized by its output directory via the "**/*" catch-all - see the deterministic and
      // see-through tests.)
      val syncTask =
          project.tasks.register("syncResources", org.gradle.api.tasks.Sync::class.java).get()
      // Generated (the fixture gitignores "dist") concrete file sources, intentionally NOT created.
      syncTask.from(java.io.File("$workspaceRoot/dist/bundle.tar.gz"))
      syncTask.from(java.io.File("$workspaceRoot/dist/runner.json"))
      // Checked-in concrete file source (NOT gitignored) - must not yield a glob.
      syncTask.from(java.io.File("$workspaceRoot/src/main/resources/config.conf"))
      // A FileTree source whose contents must never be enumerated.
      val leakDir = java.io.File("$workspaceRoot/dist/leak").apply { mkdirs() }
      java.io.File(leakDir, "secret.leak").writeText("x")
      syncTask.from(project.fileTree(leakDir))
      syncTask.into(java.io.File("$workspaceRoot/build/sync-output"))

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))

      fun outputFileGlobs(): Set<String> =
          getInputsForTask(
                  null, syncTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)
              ?.filterIsInstance<Map<*, *>>()
              ?.mapNotNull { it["dependentTasksOutputFiles"] as? String }
              ?.toSet() ?: emptySet()

      // Clean tree (generated files absent): generated concrete-file source extensions still
      // derived.
      val clean = outputFileGlobs()
      // Built tree: create the generated source files on disk.
      java.io.File("$workspaceRoot/dist/bundle.tar.gz").writeText("x")
      java.io.File("$workspaceRoot/dist/runner.json").writeText("{}")
      val built = outputFileGlobs()

      assertEquals(clean, built, "Copy source derivation must not depend on on-disk state")
      assertTrue(clean.contains("**/*.gz"), "Expected gz from generated from(File), got $clean")
      assertTrue(clean.contains("**/*.json"), "Expected json from generated from(File), got $clean")
      assertFalse(
          clean.contains("**/*.conf"), "Checked-in Copy source must not produce a glob, got $clean")
      assertFalse(
          clean.contains("**/*.leak"),
          "FileTree source contents must not be enumerated, got $clean")
    }

    @Test
    fun `test getInputsForTask Copy task itself unwraps provider and FileSystemLocation sources`() {
      // Lazy provider / FileSystemLocation sources of the Copy task ITSELF must be unwrapped so
      // their
      // extensions are derived without the file existing on disk. Gitignore "build" and "dist" so
      // the
      // generated paths count as not-checked-in.
      java.io.File(workspaceRoot, ".gitignore").writeText("dist\nbuild")

      val syncTask =
          project.tasks.register("syncResources", org.gradle.api.tasks.Sync::class.java).get()
      // Provider<RegularFile>: layout.buildDirectory.file(...) -> build/... (gitignored), NOT
      // created.
      syncTask.from(project.layout.buildDirectory.file("generated/foo.json"))
      // Bare FileSystemLocation (RegularFile) under dist/ (gitignored).
      syncTask.from(project.layout.projectDirectory.file("dist/bar.xml"))
      // Checked-in provider source (NOT gitignored) - the gate must still skip it.
      syncTask.from(project.provider { java.io.File("$workspaceRoot/src/main/resources/app.conf") })
      syncTask.into(java.io.File("$workspaceRoot/build/sync-output"))

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))

      fun outputFileGlobs(): Set<String> =
          getInputsForTask(
                  null, syncTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)
              ?.filterIsInstance<Map<*, *>>()
              ?.mapNotNull { it["dependentTasksOutputFiles"] as? String }
              ?.toSet() ?: emptySet()

      // Clean tree: none of the provider targets exist on disk yet.
      val clean = outputFileGlobs()
      // Built tree: materialize the generated provider target.
      java.io.File("$workspaceRoot/build/generated").mkdirs()
      java.io.File("$workspaceRoot/build/generated/foo.json").writeText("{}")
      val built = outputFileGlobs()

      assertEquals(clean, built, "Provider source derivation must not depend on on-disk state")
      assertTrue(
          clean.contains("**/*.json"),
          "Expected json from from(layout.buildDirectory.file(...)) on a clean tree, got $clean")
      assertTrue(
          clean.contains("**/*.xml"), "Expected xml from a FileSystemLocation source, got $clean")
      assertFalse(
          clean.contains("**/*.conf"),
          "Checked-in provider source must not produce a glob, got $clean")
    }

    @Test
    fun `test getInputsForTask Copy task itself derives its own from() source extensions`() {
      // A Copy/Sync task characterized as the CONSUMING task (not as a dependency) must contribute
      // its own declared concrete-file source extensions to its OWN inputs - the nx-api
      // processResources case, where a task bundles a generated dist/*.tar.gz via from(File). The
      // generated (gitignored) source is intentionally NOT created on disk.
      val syncTask =
          project.tasks.register("syncResources", org.gradle.api.tasks.Sync::class.java).get()
      syncTask.from(java.io.File("$workspaceRoot/dist/bundle.tar.gz"))
      syncTask.into(java.io.File("$workspaceRoot/build/sync-output"))

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))

      fun outputFileGlobs(): Set<String> =
          getInputsForTask(
                  null, syncTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)
              ?.filterIsInstance<Map<*, *>>()
              ?.mapNotNull { it["dependentTasksOutputFiles"] as? String }
              ?.toSet() ?: emptySet()

      // Clean tree: the bundle does not exist on disk.
      val clean = outputFileGlobs()
      // Built tree: create the generated source.
      java.io.File("$workspaceRoot/dist").mkdirs()
      java.io.File("$workspaceRoot/dist/bundle.tar.gz").writeText("x")
      val built = outputFileGlobs()

      assertEquals(
          clean, built, "The task's own source derivation must not depend on on-disk state")
      assertTrue(
          clean.contains("**/*.gz"),
          "Expected gz from the Copy task's own from(File) source, got $clean")
    }

    @Test
    fun `test getInputsForTask jar sees processResources output through the classes lifecycle task`() {
      // Ocean nx-api scenario: the Java plugin wires jar -> classes -> {compileJava,
      // processResources}. processResources is a Copy that bundles generated dist/ archives AND
      // copies committed resources from src/main/resources. jar reaches it only transitively
      // through
      // the opaque `classes` lifecycle task, so the traversal must see through `classes`.
      //
      // Regression: jar must watch processResources' OUTPUT directory via "**/*", which covers
      // every
      // file the copy emits - the generated bundles AND the committed application.conf. Deriving
      // from
      // the copy's sources gave jar only {**/*.gz, **/*.json} and silently missed the committed
      // resource, so editing application.conf would not invalidate the cached jar.
      project.plugins.apply("java")

      val processResources =
          project.tasks.getByName("processResources") as org.gradle.api.tasks.Copy
      processResources.from(
          java.io.File("$workspaceRoot/dist/libs/polygraph/cli/bundle/polygraph-bundle.tar.gz"))
      processResources.from(
          java.io.File("$workspaceRoot/dist/libs/polygraph/cli/bundle/polygraph-runner.json"))
      // A committed resource copied through a directory source (checked in, so it never surfaces as
      // a
      // derived source extension - only the "**/*" catch-all covers it).
      val resourcesDir = java.io.File("$workspaceRoot/src/main/resources").apply { mkdirs() }
      java.io.File(resourcesDir, "application.conf").writeText("key = value")
      processResources.from(resourcesDir)
      // The generated bundles are intentionally NOT created on disk (clean tree).

      val jar = project.tasks.getByName("jar")
      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))

      val result =
          getInputsForTask(
              null, jar, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

      println("=== getInputsForTask(jar) inputs (verbatim) ===")
      result?.forEach { println("  $it") }
      println("=== end jar inputs ===")

      assertNotNull(result, "jar inputs should not be null")
      val hasPattern = { p: String ->
        result!!.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == p }
      }
      // The catch-all covers processResources' whole output directory: the generated bundles AND
      // the
      // committed application.conf. This is the fix for the missed-committed-resource regression.
      assertTrue(
          hasPattern("**/*"),
          "jar must watch processResources' output directory via the catch-all, got $result")
      assertTrue(hasPattern("**/*.class"), "jar must see compileJava's **/*.class, got $result")
    }

    @Test
    fun `test getInputsForTask uses archiveExtension for Jar, not source extensions`() {
      // Create a Jar task with source files
      val sourceDir = java.io.File("$workspaceRoot/src/main/java").apply { mkdirs() }
      java.io.File(sourceDir, "Main.java").writeText("public class Main {}")

      val jarTask =
          project.tasks.register("packageJar", org.gradle.api.tasks.bundling.Jar::class.java).get()
      jarTask.from(sourceDir)
      // Set explicit archive extension
      jarTask.archiveExtension.set("jar")
      // Do NOT create the archive output file to simulate clean build

      // Create a consumer task that depends on the Jar task
      val consumerTask = project.tasks.register("consumerJar").get()
      consumerTask.dependsOn(jarTask)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null, consumerTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

      assertNotNull(result, "Result should not be null")

      // Should contain **/*.jar (from archiveExtension), NOT **/*.java (from source)
      assertTrue(
          result!!.any {
            it is Map<*, *> &&
                it["dependentTasksOutputFiles"] == "**/*.jar" &&
                it["transitive"] == true
          },
          "Expected **/*.jar glob from archiveExtension in result: $result")
      assertTrue(
          result.none { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.java" },
          "Should NOT have **/*.java glob for Jar task (uses archiveExtension instead): $result")
    }

    @Test
    fun `test getInputsForTask with a plain dependent yields no output-file globs`() {
      // A dependent task with no recognized type and no declared outputs contributes no
      // dependentTasksOutputFiles globs, and the derivation must not crash.
      val plainTask = project.tasks.register("plainTask").get()

      // Create a consumer task that depends on it
      val consumerTask = project.tasks.register("consumer").get()
      consumerTask.dependsOn(plainTask)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))

      val result =
          getInputsForTask(
              null, consumerTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

      // No recognized type or declared outputs -> no output-file globs (result may be null if the
      // task has no inputs at all).
      val globs =
          result?.filterIsInstance<Map<*, *>>()?.count {
            it.containsKey("dependentTasksOutputFiles")
          } ?: 0
      assertEquals(0, globs, "Plain dependent should yield no dependentTasksOutputFiles: $result")
    }

    @Test
    fun `test getInputsForTask ignores bin incremental-compilation outputs`() {
      val dependentTask = project.tasks.register("dependentCompile").get()

      val classFile = java.io.File("$workspaceRoot/build/classes/kotlin/main/Main.class")
      val incrementalBin =
          java.io.File("$workspaceRoot/build/tmp/compileJava/previous-compilation-data.bin")
      dependentTask.outputs.file(classFile)
      dependentTask.outputs.file(incrementalBin)

      val mainTask = project.tasks.register("consumerTask").get()
      mainTask.dependsOn(dependentTask)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null, mainTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

      assertNotNull(result)

      assertTrue(
          result!!.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.class" })
      assertTrue(
          result.none { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.bin" },
          "Expected no **/*.bin dependentTasksOutputFiles input, got $result")
    }

    @Test
    fun `test getInputsForTask with pre-computed dependsOnTasks`() {
      // Create dependent task with output
      val dependentTask = project.tasks.register("dependentTask").get()
      val outputFile = java.io.File("$workspaceRoot/dist/output.jar")
      dependentTask.outputs.file(outputFile)

      // Create main task with dependsOn
      val mainTask = project.tasks.register("mainTask").get()
      mainTask.dependsOn(dependentTask)

      // Add input file
      val inputFile = java.io.File("$workspaceRoot/src/main.kt")
      mainTask.inputs.files(inputFile)

      // Pre-compute dependsOnTasks using getDependsOnTask
      val preComputedDependsOn = getDependsOnTask(mainTask)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      // Test with pre-computed dependsOnTasks
      val resultWithPreComputed =
          getInputsForTask(
              preComputedDependsOn,
              mainTask,
              projectRoot,
              workspaceRoot,
              mutableMapOf(),
              gitIgnoreClassifier)

      // Test without pre-computed (should compute internally)
      val resultWithoutPreComputed =
          getInputsForTask(
              null, mainTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

      // Both results should be identical
      assertNotNull(resultWithPreComputed)
      assertNotNull(resultWithoutPreComputed)
      assertEquals(resultWithPreComputed!!.size, resultWithoutPreComputed!!.size)

      // Should contain consolidated dependentTasksOutputFiles glob pattern
      assertTrue(
          resultWithPreComputed.any {
            it is Map<*, *> &&
                it["dependentTasksOutputFiles"] == "**/*.jar" &&
                it["transitive"] == true
          })
      assertTrue(
          resultWithoutPreComputed.any {
            it is Map<*, *> &&
                it["dependentTasksOutputFiles"] == "**/*.jar" &&
                it["transitive"] == true
          })

      // Should contain the input file
      assertTrue(
          resultWithPreComputed.any { it == Path("{projectRoot}", "src", "main.kt").toString() })
      assertTrue(
          resultWithoutPreComputed.any { it == Path("{projectRoot}", "src", "main.kt").toString() })
    }

    @Test
    fun `test getDependsOnForTask with pre-computed dependsOnTasks same project returns null`() {
      // Create a build file so the task dependencies are properly detected
      val buildFile = java.io.File(project.projectDir, "build.gradle")
      buildFile.writeText("// test build file")

      val taskA = project.tasks.register("taskA").get()
      val taskB = project.tasks.register("taskB").get()
      val taskC = project.tasks.register("taskC").get()

      taskA.dependsOn(taskB, taskC)

      val dependencies = mutableSetOf<Dependency>()

      // Pre-compute dependsOnTasks using getDependsOnTask
      val preComputedDependsOn = getDependsOnTask(taskA)

      // Test with pre-computed dependsOnTasks
      val resultWithPreComputed = getDependsOnForTask(preComputedDependsOn, taskA, dependencies)

      // Test without pre-computed (should compute internally)
      val dependencies2 = mutableSetOf<Dependency>()
      val resultWithoutPreComputed = getDependsOnForTask(null, taskA, dependencies2)

      // Same-project dependencies use object format without projects field
      assertNotNull(
          resultWithPreComputed, "Same-project dependsOn should be present (pre-computed)")
      assertNotNull(resultWithoutPreComputed, "Same-project dependsOn should be present (computed)")
      assertEquals(2, resultWithPreComputed!!.size)
      assertEquals(2, resultWithoutPreComputed!!.size)
      assertTrue(
          resultWithPreComputed.all { it.projects == null },
          "Same-project deps should not have projects field")
    }

    @Test
    fun `test dependentTasksOutputFiles consolidation with multiple tasks`() {
      val project = ProjectBuilder.builder().build()
      val workspaceRoot = project.rootDir.path
      val projectRoot = project.projectDir.path

      // Create multiple dependent tasks with different output types
      val dependentTask1 = project.tasks.register("dependentTask1").get()
      val fileOutput = java.io.File("$workspaceRoot/dist/app.jar")
      dependentTask1.outputs.file(fileOutput)

      val dependentTask2 = project.tasks.register("dependentTask2").get()
      val classFile = java.io.File("$workspaceRoot/build/classes/Main.class")
      dependentTask2.outputs.file(classFile)

      val dependentTask3 = project.tasks.register("dependentTask3").get()
      val multipleOutputs =
          listOf(
              java.io.File("$workspaceRoot/reports/test.xml"),
              java.io.File("$workspaceRoot/reports/another.jar"))
      dependentTask3.outputs.files(multipleOutputs)

      // Create main task that depends on all three
      val mainTask = project.tasks.register("mainTask").get()
      mainTask.dependsOn(dependentTask1, dependentTask2, dependentTask3)

      // Add some input files
      val inputFiles =
          listOf(
              java.io.File("$workspaceRoot/src/main.kt"),
              java.io.File("$workspaceRoot/config/app.properties"))
      mainTask.inputs.files(inputFiles)

      // Get dependsOnTasks once and reuse
      val dependsOnTasks = getDependsOnTask(mainTask)
      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              dependsOnTasks,
              mainTask,
              projectRoot,
              workspaceRoot,
              mutableMapOf(),
              gitIgnoreClassifier)

      assertNotNull(result)

      // Should have consolidated glob patterns by extension
      assertTrue(
          result!!.any {
            it is Map<*, *> &&
                it["dependentTasksOutputFiles"] == "**/*.jar" &&
                it["transitive"] == true
          })
      assertTrue(
          result.any {
            it is Map<*, *> &&
                it["dependentTasksOutputFiles"] == "**/*.class" &&
                it["transitive"] == true
          })
      assertTrue(
          result.any {
            it is Map<*, *> &&
                it["dependentTasksOutputFiles"] == "**/*.xml" &&
                it["transitive"] == true
          })

      // Should contain regular input files
      assertTrue(result.any { it == Path("{projectRoot}", "src", "main.kt").toString() })
      assertTrue(result.any { it == Path("{projectRoot}", "config", "app.properties").toString() })

      // Verify we have exactly 3 dependentTasksOutputFiles entries (one per unique extension: jar,
      // class, xml)
      val dependentTasksOutputFilesCount =
          result.count { it is Map<*, *> && it.containsKey("dependentTasksOutputFiles") }
      assertEquals(3, dependentTasksOutputFilesCount)

      // Verify we have the expected number of regular input files (2)
      val regularInputsCount = result.count { it is String && it.startsWith("{projectRoot}") }
      assertEquals(2, regularInputsCount)
    }

    @Test
    fun `test getInputsForTask with gitignore classification`() {
      val project = ProjectBuilder.builder().build()
      val workspaceRoot = project.rootDir.path
      val projectRoot = project.projectDir.path

      // Create .gitignore file
      val gitignore = java.io.File(project.rootDir, ".gitignore")
      gitignore.writeText(
          """
          build
          .gradle
          *.log
          dist
          """
              .trimIndent())

      val mainTask = project.tasks.register("mainTask").get()

      // Add inputs with mixed types
      val sourceFile = java.io.File("$workspaceRoot/src/main.kt") // Not ignored - should be input
      val buildFile =
          java.io.File("$workspaceRoot/build/classes/Main.class") // Ignored - build artifact
      val logFile = java.io.File("$workspaceRoot/app.log") // Ignored - build artifact
      val configFile =
          java.io.File("$workspaceRoot/config/app.properties") // Not ignored - should be input

      mainTask.inputs.files(sourceFile, buildFile, logFile, configFile)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null, mainTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

      assertNotNull(result)

      // Source file should be regular input
      assertTrue(result!!.any { it == Path("{projectRoot}", "src", "main.kt").toString() })

      // Config file should be regular input
      assertTrue(result.any { it == Path("{projectRoot}", "config", "app.properties").toString() })

      // Gitignored build artifacts must NOT be added as direct source inputs.
      assertFalse(
          result.any { it == Path("{projectRoot}", "build", "classes", "Main.class").toString() },
          "Gitignored build artifact should not be a direct input: $result")
      assertFalse(
          result.any { it == Path("{projectRoot}", "app.log").toString() },
          "Gitignored log file should not be a direct input: $result")

      // Extensions are NOT harvested from gitignored inputs on disk; they are derived from the task
      // model (dependent task outputs). This task has no dependents, so no output-file globs exist.
      assertFalse(
          result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.class" },
          "Extensions must not be harvested from gitignored inputs on disk: $result")
      assertFalse(
          result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.log" },
          "Extensions must not be harvested from gitignored inputs on disk: $result")
    }

    @Test
    fun `test getInputsForTask gitignore patterns with nested paths`() {
      val project = ProjectBuilder.builder().build()
      val workspaceRoot = project.rootDir.path
      val projectRoot = project.projectDir.path

      // Create .gitignore with common patterns
      val gitignore = java.io.File(project.rootDir, ".gitignore")
      gitignore.writeText(
          """
          target
          dist
          """
              .trimIndent())

      val mainTask = project.tasks.register("mainTask").get()

      // Add inputs
      val javaSource = java.io.File("$workspaceRoot/src/Main.java") // Not ignored
      val compiledClass =
          java.io.File("$workspaceRoot/dist/production/Main.class") // Ignored (dist directory)
      val jarTarget = java.io.File("$workspaceRoot/dist/app.jar") // Ignored (dist directory)

      mainTask.inputs.files(javaSource, compiledClass, jarTarget)

      val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
      val result =
          getInputsForTask(
              null, mainTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

      assertNotNull(result)

      assertTrue(result!!.any { it == Path("{projectRoot}", "src", "Main.java").toString() })

      // Gitignored build artifacts must NOT be added as direct source inputs.
      assertFalse(
          result.any { it == Path("{projectRoot}", "dist", "production", "Main.class").toString() },
          "Gitignored build artifact should not be a direct input: $result")
      assertFalse(
          result.any { it == Path("{projectRoot}", "dist", "app.jar").toString() },
          "Gitignored build artifact should not be a direct input: $result")

      // Extensions are NOT harvested from gitignored inputs on disk (this task has no dependents).
      assertFalse(
          result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.class" },
          "Extensions must not be harvested from gitignored inputs on disk: $result")
      assertFalse(
          result.any { it is Map<*, *> && it["dependentTasksOutputFiles"] == "**/*.jar" },
          "Extensions must not be harvested from gitignored inputs on disk: $result")
    }
  }

  @Test
  fun `test processTask uses getDependsOnTask efficiently`() {
    val project = ProjectBuilder.builder().withName("testProject").build()
    // Create a build file so the task dependencies are properly detected
    val buildFile = java.io.File(project.projectDir, "build.gradle")
    buildFile.writeText("// test build file")

    val dependentTask = project.tasks.register("compile").get()
    val outputFile = java.io.File("${project.rootDir.path}/build/classes/Main.class")
    dependentTask.outputs.file(outputFile)

    val mainTask = project.tasks.register("test").get()
    mainTask.dependsOn(dependentTask)
    mainTask.description = "Run tests"

    // Add inputs
    val inputFile = java.io.File("${project.rootDir.path}/src/test.kt")
    mainTask.inputs.files(inputFile)

    val gitIgnoreClassifier = GitIgnoreClassifier(project.rootDir)
    val result =
        processTask(
            mainTask,
            projectBuildPath = ":testProject",
            projectRoot = project.projectDir.path,
            workspaceRoot = project.rootDir.path,
            externalNodes = mutableMapOf(),
            dependencies = mutableSetOf(),
            targetNameOverrides = emptyMap(),
            gitIgnoreClassifier = gitIgnoreClassifier,
            project = project)

    assertNotNull(result)

    // Verify basic target properties
    assertEquals("@nx/gradle:gradle", result["executor"])
    assertEquals(true, result["cache"])
    assertNotNull(result["metadata"])
    assertNotNull(result["options"])

    // Same-project dependsOn should be present as object format without projects field
    val dependsOn = result["dependsOn"] as? List<*>
    assertNotNull(dependsOn, "Same-project dependsOn should be present")
    assertTrue(
        dependsOn!!.any { (it as? DependsOnEntry)?.target == "compile" },
        "Expected dependsOn to contain 'compile', got $dependsOn")

    // Verify inputs contain both regular inputs and consolidated dependentTasksOutputFiles
    val inputs = result["inputs"] as? List<*>
    assertNotNull(inputs)
    assertTrue(inputs!!.any { it == Path("{projectRoot}", "src", "test.kt").toString() })
    assertTrue(
        inputs.any {
          it is Map<*, *> &&
              it["dependentTasksOutputFiles"] == "**/*.class" &&
              it["transitive"] == true
        })
  }

  @Nested
  inner class InferExtensionsFromInputPropertiesTests {

    @Test
    fun `compile task infers class and jar with archive dependents`() {
      val kotlinProject = ProjectBuilder.builder().withName("kotlinInferTest").build()
      kotlinProject.plugins.apply("org.jetbrains.kotlin.jvm")

      val compileTestKotlin = kotlinProject.tasks.getByName("compileTestKotlin")
      val dependsOnTasks = getDependsOnTask(compileTestKotlin)

      val extensions =
          inferExtensionsFromInputProperties(
              compileTestKotlin, dependsOnTasks, GitIgnoreClassifier(kotlinProject.rootDir))

      assertTrue(extensions.contains("class"), "Expected 'class' extension, got $extensions")
      assertTrue(
          extensions.contains("jar"),
          "Expected 'jar' extension from archive dependents, got $extensions")
    }

    @Test
    fun `kotlin compile task alone infers class via primary branch`() {
      val kotlinProject = ProjectBuilder.builder().withName("kotlinPrimaryBranch").build()
      kotlinProject.plugins.apply("org.jetbrains.kotlin.jvm")

      val compileKotlin = kotlinProject.tasks.getByName("compileKotlin")

      val extensions =
          inferExtensionsFromInputProperties(
              compileKotlin, emptySet(), GitIgnoreClassifier(kotlinProject.rootDir))

      assertTrue(
          extensions.contains("class"),
          "Expected 'class' extension from primary branch for KotlinCompile task, got $extensions")
      assertFalse(
          extensions.contains("jar"),
          "Expected no 'jar' extension with empty dependents, got $extensions")
    }

    @Test
    fun `kotlin compile dependent contributes class extension`() {
      val kotlinProject = ProjectBuilder.builder().withName("kotlinDepBranch").build()
      kotlinProject.plugins.apply("org.jetbrains.kotlin.jvm")

      val compileKotlin = kotlinProject.tasks.getByName("compileKotlin")
      val plain = kotlinProject.tasks.register("plain").get()

      val extensions =
          inferExtensionsFromInputProperties(
              plain, setOf(compileKotlin), GitIgnoreClassifier(kotlinProject.rootDir))

      assertTrue(
          extensions.contains("class"),
          "Expected 'class' from KotlinCompile dependent, got $extensions")
    }

    @Test
    fun `compile task without archive dependents does not infer jar`() {
      val project = ProjectBuilder.builder().withName("compileOnly").build()
      project.plugins.apply("java")

      val compileJava = project.tasks.getByName("compileJava")

      val extensions =
          inferExtensionsFromInputProperties(
              compileJava, emptySet(), GitIgnoreClassifier(project.rootDir))

      assertTrue(extensions.contains("class"), "Expected 'class' extension, got $extensions")
      assertFalse(
          extensions.contains("jar"), "Compile task alone should not infer 'jar', got $extensions")
    }

    @Test
    fun `archive dependent tasks infer their archive extension`() {
      val kotlinProject = ProjectBuilder.builder().withName("kotlinJarTest").build()
      kotlinProject.plugins.apply("org.jetbrains.kotlin.jvm")

      val jarTask = kotlinProject.tasks.getByName("jar")
      val dependentTasks = setOf(jarTask)

      val extensions =
          inferExtensionsFromInputProperties(
              kotlinProject.tasks.getByName("build"),
              dependentTasks,
              GitIgnoreClassifier(kotlinProject.rootDir))

      assertTrue(
          extensions.contains("jar"),
          "Expected 'jar' extension from archive task dependency, got $extensions")
    }

    @Test
    fun `test task infers class and jar regardless of dependents`() {
      val kotlinProject = ProjectBuilder.builder().withName("kotlinTestTask").build()
      kotlinProject.plugins.apply("org.jetbrains.kotlin.jvm")

      val testTask = kotlinProject.tasks.getByName("test")
      val extensions =
          inferExtensionsFromInputProperties(
              testTask, emptySet(), GitIgnoreClassifier(kotlinProject.rootDir))

      assertTrue(
          extensions.contains("class"), "Expected 'class' extension for Test task, got $extensions")
      assertTrue(
          extensions.contains("jar"), "Expected 'jar' extension for Test task, got $extensions")
    }

    @Test
    fun `plain tasks infer no extensions`() {
      val project = ProjectBuilder.builder().build()
      val task = project.tasks.register("plainTask").get()

      val extensions =
          inferExtensionsFromInputProperties(task, emptySet(), GitIgnoreClassifier(project.rootDir))

      assertTrue(extensions.isEmpty(), "Expected empty extensions for plain task, got $extensions")
    }
  }

  @Nested
  inner class ProviderBasedDependenciesTests {
    @Test
    fun `compileTestKotlin from kotlin plugin has correct provider dependencies`() {
      val kotlinProject = ProjectBuilder.builder().withName("kotlinProject").build()
      kotlinProject.plugins.apply("org.jetbrains.kotlin.jvm")

      val compileTestKotlin = kotlinProject.tasks.getByName("compileTestKotlin")
      val result = findProviderBasedDependencies(compileTestKotlin)

      assertTrue { result.contains(":compileKotlin") }
      assertTrue { result.contains(":jar") }
      assertTrue { result.contains(":compileJava") }
      assertTrue { result.contains(":checkKotlinGradlePluginConfigurationErrors") }
    }

    @Test
    fun `processTask emits includeDependsOnTasks in sorted order`() {
      val kotlinProject = ProjectBuilder.builder().withName("kotlinProject").build()
      kotlinProject.plugins.apply("org.jetbrains.kotlin.jvm")

      val compileTestKotlin = kotlinProject.tasks.getByName("compileTestKotlin")
      val result =
          processTask(
              compileTestKotlin,
              projectBuildPath = ":kotlinProject",
              projectRoot = kotlinProject.projectDir.path,
              workspaceRoot = kotlinProject.rootDir.path,
              externalNodes = mutableMapOf(),
              dependencies = mutableSetOf(),
              targetNameOverrides = emptyMap(),
              gitIgnoreClassifier = GitIgnoreClassifier(kotlinProject.rootDir),
              project = kotlinProject)

      @Suppress("UNCHECKED_CAST") val options = result["options"] as Map<String, Any?>
      @Suppress("UNCHECKED_CAST")
      val includeDependsOnTasks = options["includeDependsOnTasks"] as List<String>

      assertEquals(
          includeDependsOnTasks.sorted(),
          includeDependsOnTasks,
          "includeDependsOnTasks must be sorted so options (and the ProjectConfiguration hash) stay stable across JVM runs")
    }
  }

  @Nested
  inner class GradleFilesInputsTests {

    @Test
    fun `getGradleFilesInputs returns empty list when no gradle files exist`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        val result = getGradleFilesInputs(tempDir.path)
        assertTrue(result.isEmpty(), "Expected empty list when no gradle files exist")
      } finally {
        tempDir.deleteRecursively()
      }
    }

    @Test
    fun `getGradleFilesInputs returns gradle-wrapper files when they exist`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        // Create gradle wrapper directory and files
        val gradleWrapperDir = java.io.File(tempDir, "gradle/wrapper")
        gradleWrapperDir.mkdirs()
        java.io.File(gradleWrapperDir, "gradle-wrapper.jar").writeBytes(ByteArray(0))
        java.io.File(gradleWrapperDir, "gradle-wrapper.properties").writeText("distributionUrl=...")

        val result = getGradleFilesInputs(tempDir.path)

        assertEquals(2, result.size, "Expected 2 gradle wrapper files")
        assertTrue(
            result.contains(
                Path("{workspaceRoot}", "gradle", "wrapper", "gradle-wrapper.jar").toString()),
            "Expected gradle-wrapper.jar in $result")
        assertTrue(
            result.contains(
                Path("{workspaceRoot}", "gradle", "wrapper", "gradle-wrapper.properties")
                    .toString()),
            "Expected gradle-wrapper.properties in $result")
      } finally {
        tempDir.deleteRecursively()
      }
    }

    @Test
    fun `getGradleFilesInputs returns gradle properties when it exists`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        // Create only gradle.properties
        java.io.File(tempDir, "gradle.properties").writeText("org.gradle.jvmargs=-Xmx2g")

        val result = getGradleFilesInputs(tempDir.path)

        assertEquals(1, result.size, "Expected 1 gradle file")
        assertTrue(
            result.contains(Path("{workspaceRoot}", "gradle.properties").toString()),
            "Expected gradle.properties in $result")
      } finally {
        tempDir.deleteRecursively()
      }
    }

    @Test
    fun `getGradleFilesInputs returns all gradle files when all exist`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        // Create all gradle files
        val gradleWrapperDir = java.io.File(tempDir, "gradle/wrapper")
        gradleWrapperDir.mkdirs()
        java.io.File(gradleWrapperDir, "gradle-wrapper.jar").writeBytes(ByteArray(0))
        java.io.File(gradleWrapperDir, "gradle-wrapper.properties").writeText("distributionUrl=...")
        java.io.File(tempDir, "gradle.properties").writeText("org.gradle.jvmargs=-Xmx2g")

        val result = getGradleFilesInputs(tempDir.path)

        assertEquals(3, result.size, "Expected 3 gradle files")
        assertTrue(
            result.contains(
                Path("{workspaceRoot}", "gradle", "wrapper", "gradle-wrapper.jar").toString()),
            "Expected gradle-wrapper.jar")
        assertTrue(
            result.contains(
                Path("{workspaceRoot}", "gradle", "wrapper", "gradle-wrapper.properties")
                    .toString()),
            "Expected gradle-wrapper.properties")
        assertTrue(
            result.contains(Path("{workspaceRoot}", "gradle.properties").toString()),
            "Expected gradle.properties")
      } finally {
        tempDir.deleteRecursively()
      }
    }

    @Test
    fun `getInputsForTask includes gradle files when they exist`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        // Create gradle.properties only
        java.io.File(tempDir, "gradle.properties").writeText("org.gradle.jvmargs=-Xmx2g")

        // Create a subproject directory to differentiate projectRoot from workspaceRoot
        val projectDir = java.io.File(tempDir, "app").apply { mkdirs() }
        val project = ProjectBuilder.builder().withProjectDir(projectDir).build()
        val workspaceRoot = tempDir.path
        val projectRoot = projectDir.path

        val mainTask = project.tasks.register("mainTask").get()
        val inputFile = java.io.File("$projectRoot/src/main.kt")
        mainTask.inputs.files(inputFile)

        val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
        val result =
            getInputsForTask(
                null, mainTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

        assertNotNull(result)
        assertTrue(
            result!!.any { it == Path("{workspaceRoot}", "gradle.properties").toString() },
            "Expected gradle.properties in inputs: $result")
        assertTrue(
            result.any { it == Path("{projectRoot}", "src", "main.kt").toString() },
            "Expected src/main.kt in inputs: $result")
      } finally {
        tempDir.deleteRecursively()
      }
    }

    @Test
    fun `getInputsForTask does not include gradle files when they do not exist`() {
      val tempDir =
          java.io.File.createTempFile("workspace", "").apply {
            delete()
            mkdirs()
          }

      try {
        // Don't create any gradle files
        // Create a subproject directory to differentiate projectRoot from workspaceRoot
        val projectDir = java.io.File(tempDir, "app").apply { mkdirs() }
        val project = ProjectBuilder.builder().withProjectDir(projectDir).build()
        val workspaceRoot = tempDir.path
        val projectRoot = projectDir.path

        val mainTask = project.tasks.register("mainTask").get()
        val inputFile = java.io.File("$projectRoot/src/main.kt")
        mainTask.inputs.files(inputFile)

        val gitIgnoreClassifier = GitIgnoreClassifier(java.io.File(workspaceRoot))
        val result =
            getInputsForTask(
                null, mainTask, projectRoot, workspaceRoot, mutableMapOf(), gitIgnoreClassifier)

        assertNotNull(result)
        // Should have src/main.kt but no gradle files
        assertTrue(
            result!!.any { it == Path("{projectRoot}", "src", "main.kt").toString() },
            "Expected src/main.kt in inputs: $result")
        assertFalse(
            result.any { it.toString().contains("gradle") },
            "Did not expect any gradle files in inputs: $result")
      } finally {
        tempDir.deleteRecursively()
      }
    }
  }

  @Nested
  inner class SubprojectNamingTests {

    @Test
    fun `getNxProjectName returns correct name for root and subprojects`() {
      val rootDir =
          java.io.File.createTempFile("root", "").apply {
            delete()
            mkdirs()
          }
      val appDir = java.io.File(rootDir, "app").apply { mkdirs() }
      val childDir = java.io.File(appDir, "child").apply { mkdirs() }

      try {
        val rootProject = ProjectBuilder.builder().withProjectDir(rootDir).withName("root").build()
        val appProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(appDir)
                .withName("app")
                .build()
        val childProject =
            ProjectBuilder.builder()
                .withParent(appProject)
                .withProjectDir(childDir)
                .withName("child")
                .build()

        assertEquals("root", getNxProjectName(rootProject))
        assertEquals(":app", getNxProjectName(appProject))
        assertEquals(":app:child", getNxProjectName(childProject))
      } finally {
        rootDir.deleteRecursively()
      }
    }

    @Test
    fun `getDependsOnForTask uses buildTreePath for cross-subproject dependencies`() {
      val rootDir =
          java.io.File.createTempFile("root", "").apply {
            delete()
            mkdirs()
          }
      val appDir = java.io.File(rootDir, "app").apply { mkdirs() }
      val libDir = java.io.File(rootDir, "lib").apply { mkdirs() }

      try {
        val rootProject = ProjectBuilder.builder().withProjectDir(rootDir).withName("root").build()
        val appProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(appDir)
                .withName("app")
                .build()
        val libProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(libDir)
                .withName("lib")
                .build()

        java.io.File(appDir, "build.gradle").writeText("// app")
        java.io.File(libDir, "build.gradle").writeText("// lib")

        val libTask = libProject.tasks.register("compileJava").get()
        val appTask = appProject.tasks.register("build").get().apply { dependsOn(libTask) }

        val dependencies = mutableSetOf<Dependency>()
        val dependsOn = getDependsOnForTask(null, appTask, dependencies)

        assertNotNull(dependsOn)
        val libEntry = dependsOn!!.find { it.target == "compileJava" }
        assertNotNull(
            libEntry, "Expected dependsOn entry with target 'compileJava' but got $dependsOn")
        assertNotNull(libEntry!!.projects, "Expected 'projects' field for cross-project dependency")
        assertTrue(
            libEntry.projects!!.contains(":lib"), "Expected project ':lib' in ${libEntry.projects}")
      } finally {
        rootDir.deleteRecursively()
      }
    }

    @Test
    fun `getDependsOnForTask returns multiple entries for different cross-project targets`() {
      val rootDir =
          java.io.File.createTempFile("root", "").apply {
            delete()
            mkdirs()
          }
      val appDir = java.io.File(rootDir, "app").apply { mkdirs() }
      val libDir = java.io.File(rootDir, "lib").apply { mkdirs() }
      val utilDir = java.io.File(rootDir, "util").apply { mkdirs() }

      try {
        val rootProject = ProjectBuilder.builder().withProjectDir(rootDir).withName("root").build()
        val appProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(appDir)
                .withName("app")
                .build()
        val libProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(libDir)
                .withName("lib")
                .build()
        val utilProject =
            ProjectBuilder.builder()
                .withParent(rootProject)
                .withProjectDir(utilDir)
                .withName("util")
                .build()

        java.io.File(appDir, "build.gradle").writeText("// app")
        java.io.File(libDir, "build.gradle").writeText("// lib")
        java.io.File(utilDir, "build.gradle").writeText("// util")

        // Different targets on different projects
        val libClasses = libProject.tasks.register("classes").get()
        val libJar = libProject.tasks.register("jar").get()
        val utilClasses = utilProject.tasks.register("classes").get()

        // app:build depends on lib:classes, lib:jar, and util:classes
        val appTask =
            appProject.tasks.register("build").get().apply {
              dependsOn(libClasses, libJar, utilClasses)
            }

        val dependencies = mutableSetOf<Dependency>()
        val dependsOn = getDependsOnForTask(null, appTask, dependencies)

        assertNotNull(dependsOn, "dependsOn should not be null")
        // Should have 2 entries: "classes" (with lib + util) and "jar" (with lib)
        assertEquals(2, dependsOn!!.size, "Expected 2 dependsOn entries, got $dependsOn")

        val classesEntry = dependsOn.find { it.target == "classes" }
        assertNotNull(classesEntry, "Expected 'classes' target in $dependsOn")
        assertNotNull(classesEntry!!.projects, "Expected projects for classes entry")
        assertTrue(classesEntry.projects!!.contains(":lib"), "Expected :lib in classes projects")
        assertTrue(classesEntry.projects!!.contains(":util"), "Expected :util in classes projects")

        val jarEntry = dependsOn.find { it.target == "jar" }
        assertNotNull(jarEntry, "Expected 'jar' target in $dependsOn")
        assertNotNull(jarEntry!!.projects, "Expected projects for jar entry")
        assertTrue(jarEntry.projects!!.contains(":lib"), "Expected :lib in jar projects")
        assertEquals(1, jarEntry.projects!!.size, "jar should only have 1 project")
      } finally {
        rootDir.deleteRecursively()
      }
    }
  }
}
