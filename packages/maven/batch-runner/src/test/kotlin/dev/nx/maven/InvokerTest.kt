package dev.nx.maven

import org.apache.maven.shared.invoker.DefaultInvocationRequest
import org.apache.maven.shared.invoker.DefaultInvoker
import org.junit.jupiter.api.Test
import java.io.File
import kotlin.test.*

class InvokerTest {
  @Test
  fun test() {
    val workspaceRoot = File(InvokerTest::class.java.protectionDomain.codeSource.location.toURI())
      .resolve("../../../../..").canonicalFile
    val invoker = DefaultInvoker()

    invoker.mavenHome = workspaceRoot
    invoker.mavenExecutable = File(workspaceRoot, "mvnw")
    invoker.workingDirectory = workspaceRoot

    val request = DefaultInvocationRequest()

    request.projects = listOf("dev.nx.maven:batch-runner")

    request.goals = listOf("resources:resources")

    val stringBuilder = StringBuilder()
    invoker.setOutputHandler { line -> stringBuilder.appendLine(line) }
    val result = invoker.execute(request)

    assertNotNull(result)
    println(stringBuilder.toString())
  }
}
