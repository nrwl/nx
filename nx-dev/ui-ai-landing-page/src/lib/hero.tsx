'use client';
import { ComponentProps, ReactElement, useState } from 'react';
import { ButtonLink, SectionHeading, VideoModal } from '@nx/nx-dev/ui-common';
import {
  PlayIcon,
  CommandLineIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { sendCustomEvent } from '@nx/nx-dev/feature-analytics';
import { cx } from '@nx/nx-dev/ui-primitives';
import { MovingBorder } from '@nx/nx-dev/ui-animations';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

function PlayButton({
  className,
  ...props
}: ComponentProps<'div'>): ReactElement {
  const parent = {
    initial: {
      width: 82,
      transition: {
        when: 'afterChildren',
      },
    },
    hover: {
      width: 296,
      transition: {
        duration: 0.125,
        type: 'tween',
        ease: 'easeOut',
      },
    },
  };
  const child = {
    initial: {
      opacity: 0,
      x: -6,
    },
    hover: {
      x: 0,
      opacity: 1,
      transition: {
        duration: 0.015,
        type: 'tween',
        ease: 'easeOut',
      },
    },
  };

  return (
    <div
      className={cx(
        'group relative overflow-hidden rounded-full bg-transparent p-[1px] shadow-md',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0">
        <MovingBorder duration={5000} rx="5%" ry="5%">
          <div className="size-20 bg-[radial-gradient(var(--blue-500)_40%,transparent_60%)] opacity-[0.8] dark:bg-[radial-gradient(var(--cyan-500)_40%,transparent_60%)]" />
        </MovingBorder>
      </div>
      <motion.div
        initial="initial"
        whileHover="hover"
        variants={parent}
        className="relative isolate flex size-20 cursor-pointer items-center justify-center gap-6 rounded-full border-2 border-slate-100 bg-white/10 p-6 text-white antialiased backdrop-blur-xl"
        role="button"
        aria-label="Play video about Nx MCP"
        tabIndex={0}
      >
        <PlayIcon aria-hidden="true" className="absolute left-6 top-6 size-8" />
        <motion.div variants={child} className="absolute left-20 top-4 w-48">
          <p className="text-base font-medium">Watch the video</p>
          <p className="text-xs">See Nx AI in action.</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

interface AIFeature {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<React.ComponentProps<'svg'>>;
  videoUrl: string;
  thumbnailUrl: string;
  eventId: string;
  blogUrl?: string;
}

const aiFeatures: AIFeature[] = [
  {
    id: 'vscode-copilot',
    title: 'Integrate with your LLM via MCP',
    description:
      'Connect your AI assistants directly to your Nx workspace for deep project understanding.',
    icon: CpuChipIcon,
    videoUrl: 'https://youtu.be/RNilYmJJzdk',
    thumbnailUrl: '/images/ai/nx-copilot-mcp-yt-thumb.avif',
    eventId: 'nx-ai-vscode-video-click',
    blogUrl: '/blog/nx-mcp-vscode-copilot',
  },
  {
    id: 'ci-fixes',
    title: 'CI integration and AI-powered fixes',
    description:
      'Your LLM automatically diagnoses CI failures and suggests targeted fixes.',
    icon: ({ className, ...props }: React.ComponentProps<'svg'>) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          d="M12 2L2 7L12 12L22 7L12 2Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2 17L12 22L22 17"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M2 12L12 17L22 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    videoUrl: 'https://youtu.be/fPqPh4h8RJg',
    thumbnailUrl: '/images/ai/ai-ci-fix-thumb.avif',
    eventId: 'nx-ai-ci-video-click',
    blogUrl: '/blog/nx-editor-ci-llm-integration',
  },
  {
    id: 'terminal-integration',
    title: 'Active terminal task and log awareness',
    description:
      'Give your LLM real-time visibility into running tasks and build outputs.',
    icon: CommandLineIcon,
    videoUrl: 'https://youtu.be/Cbc9_W5J6DA',
    thumbnailUrl: '/images/ai/terminal-llm-comm-thumb.avif',
    eventId: 'nx-ai-terminal-video-click',
    // blogUrl: '/blog/nx-editor-ci-llm-integration',
  },
  {
    id: 'code-generation',
    title: 'Predictable code generation that works',
    description:
      'Generate workspace-aware code that follows your patterns and architecture.',
    icon: ({ className, ...props }: React.ComponentProps<'svg'>) => (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          d="M14 3V7C14 7.55228 14.4477 8 15 8H19"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H14L19 8V19C19 20.1046 18.1046 21 17 21Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 17H15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M9 13H15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    videoUrl: 'https://youtu.be/PXNjedYhZDs',
    thumbnailUrl: '/images/ai/video-code-gen-and-ai-thumb.avif',
    eventId: 'nx-ai-codegen-video-click',
    blogUrl: '/blog/nx-generators-ai-integration',
  },
];

export interface HeroProps {
  className?: string;
}

export function Hero(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<AIFeature>(
    aiFeatures[0]
  );

  const headingVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: 'easeOut',
      },
    },
  };

  return (
    <section className="relative overflow-hidden py-10 sm:py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header Section */}
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={headingVariants}
            className="mb-16"
          >
            <SectionHeading
              as="h1"
              variant="display"
              className="text-pretty tracking-tight"
            >
              AI that{' '}
              <span className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                actually works
              </span>{' '}
              <br className="hidden md:block" />
              for large codebases
            </SectionHeading>
          </motion.div>
        </div>

        {/* Interactive Video + Features Section */}
        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
          {/* Video Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mb-12 lg:mb-0"
          >
            <div className="relative">
              <div className="absolute bottom-0 start-0 -z-10 -translate-x-14 translate-y-10">
                <svg
                  className="h-auto max-w-40 text-slate-200 dark:text-slate-800"
                  width="696"
                  height="653"
                  viewBox="0 0 696 653"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="72.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="171.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="270.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="369.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="468.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="567.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="666.5" cy="29.5" r="29.5" fill="currentColor" />
                  <circle cx="29.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="128.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="227.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="326.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="425.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="524.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="623.5" cy="128.5" r="29.5" fill="currentColor" />
                  <circle cx="72.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="171.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="270.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="369.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="468.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="567.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="666.5" cy="227.5" r="29.5" fill="currentColor" />
                  <circle cx="29.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="128.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="227.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="326.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="425.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="524.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="623.5" cy="326.5" r="29.5" fill="currentColor" />
                  <circle cx="72.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="171.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="270.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="369.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="468.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="567.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="666.5" cy="425.5" r="29.5" fill="currentColor" />
                  <circle cx="29.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="128.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="227.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="326.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="425.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="524.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="623.5" cy="524.5" r="29.5" fill="currentColor" />
                  <circle cx="72.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="171.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="270.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="369.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="468.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="567.5" cy="623.5" r="29.5" fill="currentColor" />
                  <circle cx="666.5" cy="623.5" r="29.5" fill="currentColor" />
                </svg>
              </div>

              <div className="overflow-hidden rounded-xl shadow-2xl">
                <div className="absolute inset-0 z-0 rounded-xl bg-gradient-to-tr from-blue-500/10 to-cyan-500/10"></div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedFeature.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <Image
                      src={selectedFeature.thumbnailUrl}
                      alt={`${selectedFeature.title} video thumbnail`}
                      width={960}
                      height={540}
                      loading="lazy"
                      unoptimized
                      className="relative w-full transform rounded-xl transition-transform duration-300 hover:scale-[1.02]"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedFeature.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 grid h-full w-full items-center justify-center"
                >
                  <PlayButton
                    onClick={() => {
                      setIsOpen(true);
                      sendCustomEvent(
                        selectedFeature.eventId,
                        'ai-landing-hero-video',
                        'ai-landing'
                      );
                    }}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {selectedFeature.blogUrl && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedFeature.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="mt-6 flex justify-center"
                >
                  <a
                    href={selectedFeature.blogUrl}
                    className="group inline-flex items-center gap-2 text-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    onClick={() =>
                      sendCustomEvent(
                        `${selectedFeature.eventId}-learn-more`,
                        'ai-landing-hero-learn-more',
                        'ai-landing'
                      )
                    }
                  >
                    Learn more about {selectedFeature.title.toLowerCase()}
                    <motion.span
                      className="inline-block"
                      animate={{ x: 0 }}
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      →
                    </motion.span>
                  </a>
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>

          {/* Features Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="w-full flex-auto"
          >
            <div className="space-y-2">
              {aiFeatures.map((feature, index) => {
                const Icon = feature.icon;
                const isSelected = selectedFeature.id === feature.id;

                return (
                  <button
                    key={feature.id}
                    onClick={() => setSelectedFeature(feature)}
                    className={cx(
                      'group flex w-full gap-4 rounded-lg p-4 text-left transition-all duration-200',
                      {
                        'bg-blue-50 ring-2 ring-blue-500 dark:bg-blue-950/50 dark:ring-blue-400':
                          isSelected,
                        'hover:bg-slate-100 dark:hover:bg-slate-800':
                          !isSelected,
                      }
                    )}
                  >
                    <motion.div
                      animate={{
                        scale: isSelected ? 1.1 : 1,
                        rotate: isSelected ? 5 : 0,
                      }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <Icon
                        aria-hidden="true"
                        className={cx(
                          'size-6 shrink-0 transition-colors',
                          isSelected
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-blue-500'
                        )}
                      />
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <h4
                        className={cx(
                          'relative text-base font-medium leading-6 transition-colors',
                          isSelected
                            ? 'text-blue-900 dark:text-blue-100'
                            : 'text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400'
                        )}
                      >
                        {feature.title}
                        <motion.span
                          className={cx(
                            'ml-1 transition-opacity',
                            isSelected
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100'
                          )}
                          animate={{ x: isSelected ? 4 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          →
                        </motion.span>
                      </h4>
                      <p
                        className={cx(
                          'mt-2 text-sm leading-6 transition-colors',
                          isSelected
                            ? 'text-blue-700 dark:text-blue-200'
                            : 'text-slate-600 dark:text-slate-400'
                        )}
                      >
                        {feature.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="mt-8 flex justify-start"
            >
              <ButtonLink
                href="/features/enhance-AI#setting-up-nx-mcp"
                variant="primary"
                size="default"
                title="Enhance your AI assistant"
                onClick={() =>
                  sendCustomEvent(
                    'ai-landing-enhance-click',
                    'ai-landing-hero',
                    'ai-landing'
                  )
                }
              >
                Enhance your AI assistant
              </ButtonLink>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <VideoModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        videoUrl={selectedFeature.videoUrl}
      />
    </section>
  );
}
