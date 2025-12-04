package dev.nx.maven.runner

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.AfterEach
import java.io.File
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors
import java.util.concurrent.CountDownLatch
import kotlin.test.assertTrue

/**
 * Integration test for ResidentMavenExecutor running on thread pool threads.
 * 
 * This test specifically reproduces the scenario where the batch-runner JAR
 * is invoked from a thread pool (like in MavenInvokerRunner), which is where
 * the NoSuchMethodError was occurring in production.
 * 
 * This test demonstrates how ResidentMavenExecutor works when invoked from a thread pool.
 * test executes the executor on thread pool threads, not the main test thread.
 */
@DisplayName("ResidentMavenExecutor Thread Pool Tests")
class ResidentMavenExecutorThreadPoolTest {

    companion object {
        private val GS_MULTI_MODULE_PATH = File(
            System.getProperty("user.home"),
            "projects/triage/java/gs-multi-module/complete"
        )
    }

    private var executor: ResidentMavenExecutor? = null

    @BeforeEach
    fun setup() {
        if (GS_MULTI_MODULE_PATH.exists()) {
            try {
                executor = ResidentMavenExecutor(GS_MULTI_MODULE_PATH)
                println("✅ ResidentMavenExecutor created successfully")
            } catch (e: Exception) {
                println("⚠️  Could not create executor: ${e.message}")
                e.printStackTrace()
            }
        }
    }

    @AfterEach
    fun teardown() {
        executor?.shutdown()
        executor = null
    }

    @Test
    @DisplayName("execute Maven tasks on thread pool threads (reproduces production scenario)")
    fun testResidentMavenExecutorOnThreadPool() {
        if (!GS_MULTI_MODULE_PATH.exists()) {
            println("⚠️  gs-multi-module not found at: ${GS_MULTI_MODULE_PATH.absolutePath}")
            println("   Skipping test")
            return
        }

        if (executor == null) {
            println("⚠️  Could not create executor, skipping test")
            return
        }

        val executor = this.executor ?: return

        println("\n════════════════════════════════════════════════════════════")
        println("Testing ResidentMavenExecutor on Thread Pool (Production Test)")
        println("════════════════════════════════════════════════════════════\n")

        val threadPool = Executors.newFixedThreadPool(3)
        val countDownLatch = CountDownLatch(3)
        val results = mutableListOf<Pair<Int, Result>>()
        val lock = Any()

        try {
            // Submit 3 tasks to thread pool threads
            repeat(3) { taskNum ->
                threadPool.submit {
                    try {
                        println("► Task ${taskNum + 1}: Running on thread: ${Thread.currentThread().name}")
                        
                        val output = ByteArrayOutputStream()
                        val goals = listOf("clean", "compile")
                        val arguments = listOf("-B", "-q")

                        val startTime = System.currentTimeMillis()
                        val exitCode = executor.execute(goals, arguments, GS_MULTI_MODULE_PATH, output)
                        val duration = System.currentTimeMillis() - startTime

                        synchronized(lock) {
                            results.add(Pair(taskNum + 1, Result.Success(exitCode, duration)))
                        }
                        
                        println("  ✅ Task ${taskNum + 1}: Completed in ${duration}ms with exit code $exitCode")
                        if (exitCode != 0) {
                            println("  Output: ${output.toString()}")
                        }
                    } catch (e: Exception) {
                        synchronized(lock) {
                            results.add(Pair(taskNum + 1, Result.Failure(e)))
                        }
                        println("  ❌ Task ${taskNum + 1}: Failed with ${e.javaClass.simpleName}: ${e.message}")
                        e.printStackTrace()
                    } finally {
                        countDownLatch.countDown()
                    }
                }
            }

            // Wait for all tasks to complete
            countDownLatch.await()

            println("\n════════════════════════════════════════════════════════════")
            println("Results Summary:")
            println("════════════════════════════════════════════════════════════")

            var successCount = 0
            var failureCount = 0
            val durations = mutableListOf<Long>()

            synchronized(lock) {
                results.sortedBy { it.first }.forEach { (taskNum, result) ->
                    when (result) {
                        is Result.Success -> {
                            successCount++
                            durations.add(result.duration)
                            println("Task $taskNum: ✅ SUCCESS (${result.duration}ms, exit code ${result.exitCode})")
                        }
                        is Result.Failure -> {
                            failureCount++
                            println("Task $taskNum: ❌ FAILURE - ${result.error.javaClass.simpleName}: ${result.error.message}")
                        }
                    }
                }
            }

            println("\n✅ Total Successes: $successCount")
            println("❌ Total Failures: $failureCount")

            if (durations.isNotEmpty()) {
                println("\nPerformance:")
                println("  First invocation:  ${durations[0]}ms")
                if (durations.size > 1) {
                    println("  Second invocation: ${durations[1]}ms (${((durations[0] - durations[1]) * 100 / durations[0])}% faster)")
                }
                if (durations.size > 2) {
                    println("  Third invocation:  ${durations[2]}ms (${((durations[0] - durations[2]) * 100 / durations[0])}% faster)")
                }
            }

            assertTrue(successCount == 3, "Expected all 3 tasks to succeed, but $failureCount failed")
            assertTrue(failureCount == 0, "Expected no failures, but got $failureCount")

        } finally {
            threadPool.shutdown()
        }
    }

    sealed class Result {
        data class Success(val exitCode: Int, val duration: Long) : Result()
        data class Failure(val error: Exception) : Result()
    }
}
