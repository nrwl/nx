package dev.nx.maven.adapter.maven4

import dev.nx.maven.adapter.AdapterInvoker
import org.apache.maven.api.cli.ParserRequest
import org.apache.maven.api.services.Lookup
import org.apache.maven.cling.invoker.ProtoLookup
import org.apache.maven.cling.invoker.mvn.MavenParser
import org.apache.maven.jline.JLineMessageBuilderFactory
import org.codehaus.plexus.classworlds.ClassWorld
import org.slf4j.LoggerFactory
import java.io.File
import java.io.OutputStream
import java.io.PrintStream

/**
 * Maven 4 adapter that implements AdapterInvoker interface.
 *
 * This class wraps CachingResidentMavenInvoker and handles all Maven 4 specific
 * request building, eliminating the need for reflection in the batch-runner.
 */
class Maven4AdapterInvoker(
    classWorld: ClassWorld,
    private val mavenHome: File
) : AdapterInvoker {

    private val log = LoggerFactory.getLogger(Maven4AdapterInvoker::class.java)

    private val invoker: CachingResidentMavenInvoker
    private val parser: MavenParser
    private val messageBuilderFactory = JLineMessageBuilderFactory()

    init {
        log.debug("Initializing Maven4AdapterInvoker")

        // Create ProtoLookup with ClassWorld mapping
        val protoLookup: Lookup = ProtoLookup.builder()
            .addMapping(ClassWorld::class.java, classWorld)
            .build()

        // Create CachingResidentMavenInvoker
        invoker = CachingResidentMavenInvoker(protoLookup, null)

        // Create MavenParser
        parser = MavenParser()

        log.debug("Maven4AdapterInvoker ready")
    }

    override fun invoke(
        args: List<String>,
        workingDir: File,
        stdout: OutputStream,
        stderr: OutputStream
    ): Int {
        log.debug("invoke() with args: ${args.joinToString(" ")} in ${workingDir.absolutePath}")
        val startTime = System.currentTimeMillis()

        // Force batch mode to avoid SimplexTransferListener deadlock
        val allArgs = if ("-B" !in args && "--non-interactive" !in args) {
            args + "-B"
        } else {
            args
        }

        return try {
            // Create ParserRequest
            val parserRequest = ParserRequest.mvn(allArgs, messageBuilderFactory)
                .cwd(workingDir.toPath())
                .userHome(File(System.getProperty("user.home")).toPath())
                .stdOut(stdout)
                .stdErr(stderr)
                .embedded(true)
                .mavenHome(mavenHome.toPath())
                .build()

            // Parse to get InvokerRequest
            val invokerRequest = parser.parseInvocation(parserRequest)

            // Check if parsing failed
            if (invokerRequest.parsingFailed()) {
                log.error("Maven argument parsing failed for: ${allArgs.joinToString(" ")}")
                stdout.write("ERROR: Maven argument parsing failed\n".toByteArray())
                return 1
            }

            // Invoke Maven - prevent stdin blocking
            val originalIn = System.`in`
            System.setIn(java.io.ByteArrayInputStream(ByteArray(0)))

            val exitCode = try {
                invoker.invoke(invokerRequest)
            } finally {
                System.setIn(originalIn)
            }

            val duration = System.currentTimeMillis() - startTime
            log.debug("Maven 4 completed in ${duration}ms with exit code: $exitCode")
            exitCode
        } catch (e: Exception) {
            log.error("Error during Maven invocation: ${e.message}", e)
            PrintStream(stderr, true).println("ERROR: ${e.message}")
            e.printStackTrace(PrintStream(stderr, true))
            1
        }
    }

    override fun recordBuildStates(projectSelectors: Set<String>) {
        val nxMaven = invoker.getNxMaven()
        if (nxMaven == null) {
            log.debug("Recording build states skipped - NxMaven not initialized")
            return
        }
        nxMaven.recordBuildStates(projectSelectors)
    }

    override fun close() {
        log.debug("Closing Maven4AdapterInvoker...")
        try {
            invoker.close()
        } catch (e: Exception) {
            log.warn("Error closing invoker: ${e.message}")
        }
    }
}
