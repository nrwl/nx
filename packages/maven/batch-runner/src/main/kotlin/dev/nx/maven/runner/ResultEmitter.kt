package dev.nx.maven.runner

import com.google.gson.Gson
import dev.nx.maven.data.TaskResult
import org.slf4j.LoggerFactory
import java.io.PrintWriter
import java.net.Socket

/**
 * Interface for emitting task results to the parent process.
 */
interface ResultEmitter {
    fun emit(taskId: String, result: TaskResult)
    fun close() {}
}

/**
 * TCP-based result emitter.
 * Connects to a local port and sends JSON results as single lines.
 */
class TcpResultEmitter(port: Int, private val gson: Gson) : ResultEmitter {
    private val log = LoggerFactory.getLogger(TcpResultEmitter::class.java)
    private var socket: Socket? = null
    private var writer: PrintWriter? = null

    init {
        try {
            log.debug("Connecting to result communication port: $port")
            socket = Socket("127.0.0.1", port)
            writer = PrintWriter(socket!!.getOutputStream(), true)
            log.debug("Connected to result communication port: $port")
        } catch (e: Exception) {
            log.error("Failed to connect to result communication port $port: ${e.message}", e)
        }
    }

    override fun emit(taskId: String, result: TaskResult) {
        val currentWriter = writer
        if (currentWriter != null) {
            val resultData = mapOf(
                "task" to taskId,
                "result" to mapOf(
                    "success" to result.success,
                    "terminalOutput" to result.terminalOutput,
                    "startTime" to result.startTime,
                    "endTime" to result.endTime
                )
            )
            val json = gson.toJson(resultData)
            currentWriter.println(json)
        } else {
            log.warn("Cannot emit result for $taskId: TCP writer is null")
        }
    }

    override fun close() {
        try {
            writer?.close()
            socket?.close()
            log.debug("Closed result communication socket")
        } catch (e: Exception) {
            log.error("Error closing result communication socket: ${e.message}")
        }
    }
}
