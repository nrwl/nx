---
title: 'UKG Unifies Their Codebase and Eliminates CI Overhead to Focus on Customer Value'
slug: ukg-success-story
authors: [Juri Strumpflohner]
tags: ['customer story']
description: Discover how UKG transformed their development workflow by leveraging Nx and Nx Cloud to eliminate build bottlenecks and enable cross-platform code sharing.
cover_image: /blog/images/articles/bg-ukg-success-story.avif
youtubeUrl: https://www.youtube.com/watch?v=rSC8wihnfP4
metrics:
  - value: 'Instant build'
    label: 'feedback loops'
  - value: 'Zero CI overhead'
    label: ''
  - value: '1 Unified Codebase'
    label: 'across mobile and web'
---

UKG is a leading human capital management company that provides comprehensive workforce solutions to organizations worldwide. Their platform helps businesses manage everything from payroll and benefits to talent acquisition and performance management. As a technology-driven company serving diverse client needs, UKG's engineering teams must deliver robust, scalable solutions across multiple platforms and experiences.

Their Angular, TypeScript, and JavaScript monorepo, enhanced with NgRx for state management, serves as the foundation for their development workflow. However, as their organization scaled, they encountered significant challenges that threatened their ability to deliver value efficiently to customers.

## Challenge

UKG's engineering organization faced two critical bottlenecks that were severely impacting their development velocity and team productivity.

**Code Duplication Across Platforms**

Feature teams consistently requested the ability to build experiences that could be deployed on both mobile and web platforms. However, without proper code sharing mechanisms, teams found themselves rewriting existing functionality for each platform.

This duplication created maintenance overhead, inconsistent user experiences across platforms, and significantly slowed down feature development velocity as teams couldn't leverage existing solutions.

**Build Time Bottlenecks and CI Maintenance Overhead**

UKG was managing their own CI infrastructure, which created significant performance and operational challenges. Developers were regularly waiting half a day to a full day for builds to complete, forcing them to switch between tasks and breaking their development flow.

The engineering team found themselves caught in a cycle where substantial effort was being invested in optimizing and maintaining their CI infrastructure rather than focusing on customer value and developer experience improvements.

## Solution

UKG adopted Nx to address their monorepo challenges and leveraged Nx Cloud to eliminate their CI performance bottlenecks. The solution focused on two key areas: enabling efficient code reuse and eliminating CI maintenance overhead.

**Enabling Cross-Platform Code Reuse**

The monorepo structure provided the perfect solution for UKG's cross-platform development needs. By having all code in the same repository, teams could now easily create and share reusable components and functionality that work across both mobile and web experiences, eliminating the need to rewrite code for different platforms. Nx serves as the powerful tool that helps manage this monorepo efficiently, ensuring proper dependency management and preventing wrong dependencies between packages.

**Eliminating CI Maintenance with Nx Cloud**

The transition to Nx Cloud provided immediate relief from their CI performance challenges. Nx Cloud's intelligent caching and task distribution eliminated the need for manual CI optimization, allowing build times that previously took half a day to a full day to be reduced to minutes.

{% testimonial
    name="Sid"
    title="Engineering Manager, UKG"
    image="https://avatars.githubusercontent.com/u/6657673?v=4" %}
With going into Nx Cloud our developers can focus on the things that actually matter for our developers experience and getting experience to our customers so this just gave us a lot more advantage of where to invest our effort into and where not to.
{% /testimonial %}

**Strategic Partnership with Nx Developer Productivity Team**

A key aspect of UKG's success has been their ongoing partnership with the Nx Developer Productivity Engineering (DPE) team through regular check-ins and collaborative planning. These sessions provide proactive support, feature roadmap alignment, and guided optimization to help UKG scale and grow their monorepo architecture.

> "I really like the Nx check-ins because every time I go into those meetings the folks that come from Nx are very well prepared to how they can help our team grow scale and to help us solve some of our challenges."

## Results

### Eliminated Build Wait Times and Context Switching

The most immediate and impactful improvement was the dramatic reduction in build times. Developers no longer face half-day or full-day build delays, enabling them to stay focused on their current tasks without lengthy interruptions.

{% testimonial
    name="Sid"
    title="Engineering Manager, UKG"
    image="https://avatars.githubusercontent.com/u/6657673?v=4" %}
Before Nx Cloud it was developers waiting day or half a day waiting for the builds and after Nx it's just like let me get to the next task we're more productive less context switching.
{% /testimonial %}

### Established Efficient Code Sharing Across Platforms

UKG successfully solved their code duplication problem by establishing an efficient way to share code across their web and mobile platforms. Teams can now build cross-platform experiences using proven, reusable components, leading to faster feature development and consistent user experiences across mobile and web applications.

### Refocused Engineering Efforts on Customer Value

By eliminating CI maintenance overhead, UKG freed up significant engineering resources. Teams now invest time in developer experience improvements and customer-facing features rather than infrastructure optimization. As their team noted, this gave them "a lot more advantage of where to invest our effort into and where not to." The engineering organization gained strategic clarity on investment priorities, with automated CI optimization through Nx Cloud allowing them to redirect efforts toward what truly matters for their customers.

### Long-term Confidence in Technology Choice

UKG's experience has created strong confidence in their technology stack and future scalability:

> "It is hands down one of the best build tools and I can't see a future where we don't have Nx."

This level of satisfaction demonstrates not just immediate problem-solving, but a foundation for long-term scalable development practices that will support UKG's continued growth and innovation.

{% call-to-action title="Ready to eliminate build bottlenecks?" url="/enterprise" icon="nxcloud" description="Learn how Nx Enterprise can help your team achieve similar productivity gains." /%}
