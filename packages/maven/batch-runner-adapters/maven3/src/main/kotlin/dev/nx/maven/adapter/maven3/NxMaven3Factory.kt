package dev.nx.maven.adapter.maven3

import org.apache.maven.graph.GraphBuilder
import org.apache.maven.lifecycle.internal.ExecutionEventCatapult
import org.apache.maven.lifecycle.internal.LifecycleStarter
import org.apache.maven.plugin.LegacySupport
import org.apache.maven.session.scope.internal.SessionScope
import org.codehaus.plexus.PlexusContainer
import org.slf4j.LoggerFactory

/**
 * Factory for creating NxMaven3 instances.
 *
 * This factory looks up the required Maven components from the Plexus container
 * and creates a properly configured NxMaven3 instance.
 */
object NxMaven3Factory {
    private val log = LoggerFactory.getLogger(NxMaven3Factory::class.java)

    /**
     * Create an NxMaven3 instance from a PlexusContainer.
     *
     * @param container The Plexus container with Maven components
     * @return A configured NxMaven3 instance
     */
    fun create(container: PlexusContainer): NxMaven3 {
        log.debug("Creating NxMaven3 from PlexusContainer...")

        // Look up required components
        val eventCatapult = container.lookup(ExecutionEventCatapult::class.java)
        val legacySupport = container.lookup(LegacySupport::class.java)
        val sessionScope = container.lookup(SessionScope::class.java)
        val graphBuilder = container.lookup(GraphBuilder::class.java, GraphBuilder.HINT)
        val lifecycleStarter = container.lookup(LifecycleStarter::class.java)

        log.debug("  EventCatapult: ${eventCatapult.javaClass.name}")
        log.debug("  LegacySupport: ${legacySupport.javaClass.name}")
        log.debug("  SessionScope: ${sessionScope.javaClass.name}")
        log.debug("  GraphBuilder: ${graphBuilder.javaClass.name}")
        log.debug("  LifecycleStarter: ${lifecycleStarter.javaClass.name}")

        return NxMaven3(
            container = container,
            eventCatapult = eventCatapult,
            legacySupport = legacySupport,
            sessionScope = sessionScope,
            graphBuilder = graphBuilder,
            lifecycleStarter = lifecycleStarter
        )
    }
}
