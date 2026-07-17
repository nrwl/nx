package dev.nx.gradle.utils

import io.opentelemetry.api.OpenTelemetry
import io.opentelemetry.api.common.AttributeKey
import io.opentelemetry.api.common.Attributes
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.StatusCode
import io.opentelemetry.api.trace.Tracer
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter
import io.opentelemetry.sdk.OpenTelemetrySdk
import io.opentelemetry.sdk.resources.Resource
import io.opentelemetry.sdk.trace.SdkTracerProvider
import io.opentelemetry.sdk.trace.export.SimpleSpanProcessor

object NxTracing {

  private const val INSTRUMENTATION_NAME = "nx-gradle-project-graph"

  private val otlpEndpoint: String? = System.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")

  private val sdk: OpenTelemetrySdk? =
      if (otlpEndpoint != null) {
        val exporter = OtlpGrpcSpanExporter.builder().setEndpoint(otlpEndpoint).build()
        val resource =
            Resource.getDefault()
                .merge(
                    Resource.create(
                        Attributes.of(
                            AttributeKey.stringKey("service.name"), INSTRUMENTATION_NAME)))
        val tracerProvider =
            SdkTracerProvider.builder()
                .addSpanProcessor(SimpleSpanProcessor.create(exporter))
                .setResource(resource)
                .build()
        OpenTelemetrySdk.builder().setTracerProvider(tracerProvider).build()
      } else {
        null
      }

  val tracer: Tracer = (sdk ?: OpenTelemetry.noop()).getTracer(INSTRUMENTATION_NAME)

  fun shutdown() {
    sdk?.sdkTracerProvider?.forceFlush()
  }

  inline fun <T> withSpan(
      name: String,
      attributes: Map<String, String> = emptyMap(),
      block: (Span) -> T
  ): T {
    val span =
        tracer
            .spanBuilder(name)
            .also { builder ->
              attributes.forEach { (key, value) ->
                builder.setAttribute(AttributeKey.stringKey(key), value)
              }
            }
            .startSpan()
    val scope = span.makeCurrent()
    return try {
      block(span)
    } catch (e: Exception) {
      span.setStatus(StatusCode.ERROR, e.message ?: "unknown error")
      span.recordException(e)
      throw e
    } finally {
      scope.close()
      span.end()
    }
  }
}
