---
title: 'UKG Eliminates Day-Long Build Waits and Reduces Code Duplication with Nx Monorepo'
slug: ukg-success-story
authors: [Juri Strumpflohner]
tags: ['customer story']
description: Discover how UKG transformed their development workflow by leveraging Nx and Nx Cloud to eliminate build bottlenecks and enable cross-platform code sharing.
youtubeUrl: https://www.youtube.com/watch?v=rSC8wihnfP4
metrics:
  - value: 'Hours→Minutes'
    label: 'build wait times'
  - value: 'Less code duplication'
    label: 'across mobile and web'
  - value: 'Less context switching'
    label: 'developers stay in flow'
  - value: 'Focus on what matters'
    label: 'developer experience and customer value'
---

UKG is a leading human capital management company that provides comprehensive workforce solutions to organizations worldwide. Their platform helps businesses manage everything from payroll and benefits to talent acquisition and performance management. As a technology-driven company serving diverse client needs, UKG's engineering teams must deliver robust, scalable solutions across multiple platforms and experiences.

## Challenge

UKG's engineering organization faced several critical challenges as they scaled their development efforts across multiple teams and platforms:

### Code Duplication Across Platforms

Feature teams consistently requested the ability to build experiences that could be deployed on both mobile and web platforms. However, without proper code sharing mechanisms, teams found themselves rewriting existing functionality:

> "If they have to do the same thing they have to rewrite some of the code that we already have."

This duplication created maintenance overhead and inconsistent user experiences across platforms, while slowing down feature development velocity.

### Build Time Bottlenecks

UKG was managing their own CI infrastructure, which created significant performance challenges:

- **Hour-long build waits** – Developers were regularly waiting half a day to a full day for builds to complete
- **Inefficient CI maintenance** – The team spent considerable time and effort trying to optimize their custom CI setup
- **Context switching overhead** – Long build times forced developers to switch between tasks, breaking their flow and reducing productivity

### Resource Allocation Inefficiencies

With so much engineering effort focused on maintaining CI infrastructure and dealing with build delays, teams had less time to focus on what truly mattered:

> "We were spending a lot more time and effort to maintain that... us maintaining our own CI and like breaking down things so that it improves our build time and our test time was not really efficient."

The engineering organization needed a solution that would allow them to redirect their efforts toward customer value and developer experience improvements.

## Solution

UKG adopted Nx to address their monorepo challenges and leverage Nx Cloud to eliminate their CI performance bottlenecks. Their Angular, TypeScript, and JavaScript monorepo, enhanced with NgRx for state management, became the foundation for a more efficient development workflow.

### Enabling Code Reuse Across Platforms

Nx's library architecture provided the perfect solution for UKG's cross-platform development needs:

- **Shared libraries** – Teams could now build reusable components and functionality that work across both mobile and web experiences
- **Reduced duplication** – Instead of rewriting code, feature teams could leverage existing libraries and build on top of proven solutions
- **Consistent experiences** – Shared code ensured consistent behavior and user experiences across all platforms

> "This way it helps us use our libraries and they can build experience on top of what we already built so less code duplication."

### Eliminating CI Maintenance Overhead with Nx Cloud

The transition to Nx Cloud provided immediate relief from their CI performance challenges:

- **Automated optimization** – Nx Cloud's intelligent caching and task distribution eliminated the need for manual CI optimization
- **Dramatic time savings** – Build times that previously took half a day to a full day were reduced to minutes
- **Resource reallocation** – Engineering teams could redirect their efforts from CI maintenance to feature development

{% testimonial
    name="Sid"
    title="Engineer, UKG"
    image="/documentation/blog/images/articles/ukg-engineer.avif" %}
With going into Nx Cloud our developers can focus on the things that actually matter for our developers experience and getting experience to our customers so this just gave us a lot more advantage of where to invest our effort into and where not to.
{% /testimonial %}

### Strategic Partnership and Continuous Improvement

UKG established a strong partnership with the Nx team through regular check-ins and collaborative planning:

- **Proactive support** – Regular meetings with well-prepared Nx team members who understand UKG's specific challenges
- **Feature roadmap alignment** – Early access to new features and realistic timelines for adoption
- **Guided optimization** – Ongoing support to help UKG scale and grow their monorepo architecture

> "I really like the Nx check-ins because every time I go into those meetings the folks that come from Nx are very well prepared to how they can help our team grow scale and to help us solve some of our challenges."

## Results

### Eliminated Build Wait Times and Context Switching

The most immediate and impactful improvement was the dramatic reduction in build times:

- **From day-long waits to minutes** – Developers no longer face half-day or full-day build delays
- **Improved productivity** – Teams can stay focused on their current tasks without lengthy interruptions
- **Reduced context switching** – Faster feedback loops keep developers in their flow state

{% testimonial
    name="Sid"
    title="Engineer, UKG"
    image="/documentation/blog/images/articles/ukg-engineer.avif" %}
Before Nx Cloud it was developers waiting day or half a day waiting for the builds and after Nx it's just like let me get to the next task we're more productive less context switching.
{% /testimonial %}

### Achieved Zero Code Duplication Across Platforms

UKG successfully eliminated the code duplication that was slowing down their feature teams:

- **Shared library ecosystem** – Teams can now build cross-platform experiences using proven, reusable components
- **Faster feature development** – No more rewriting existing functionality for different platforms
- **Consistent user experiences** – Shared code ensures uniform behavior across mobile and web applications

### Refocused Engineering Efforts on Customer Value

By eliminating CI maintenance overhead, UKG freed up significant engineering resources:

- **Strategic resource allocation** – Teams now invest time in developer experience improvements and customer-facing features
- **Reduced operational burden** – No more manual CI optimization and maintenance
- **Clear investment priorities** – Better understanding of where to focus engineering efforts for maximum impact

### Long-term Confidence in Technology Choice

UKG's experience has created strong confidence in their technology stack:

> "It is hands down one of the best build tools and I can't see a future where we don't have Nx."

This level of satisfaction demonstrates not just immediate problem-solving, but a foundation for long-term scalable development practices.

{% call-to-action title="Ready to eliminate build bottlenecks?" url="/enterprise" icon="nxcloud" description="Learn how Nx Enterprise can help your team achieve similar productivity gains." /%}
