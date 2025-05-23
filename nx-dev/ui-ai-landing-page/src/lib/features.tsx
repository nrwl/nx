import { SectionHeading } from '@nx/nx-dev/ui-common';
import { cx } from '@nx/nx-dev/ui-primitives';
import { CommandLineIcon } from '@heroicons/react/24/outline';
import { ReactElement } from 'react';

export function Features(): ReactElement {
  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 text-left">
          <SectionHeading as="h2" variant="title">
            Make your AI workspace-aware
          </SectionHeading>

          <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
            Transform your AI from context-blind to architecture-aware with
            complete workspace intelligence.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Workspace intelligence"
            description="Elevate your AI from file-level to architecture-level understanding with project relationship mapping and dependency analysis."
            href="/blog/nx-mcp-vscode-copilot"
            icon={
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="8"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="6"
                  cy="16"
                  r="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="18"
                  cy="16"
                  r="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M9.5 9.5L7 14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M14.5 9.5L17 14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M8 16L16 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            }
          />
          <FeatureCard
            title="CI integration & failure resolution"
            description="Fix CI issues before you even know they exist with real-time failure notifications and AI-powered analysis."
            href="/blog/nx-editor-ci-llm-integration"
            icon={
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
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
            }
          />
          <FeatureCard
            title="Terminal integration"
            description="Your AI assistant sees what you see in the terminal with real-time output awareness and contextual error analysis."
            href="#"
            icon={<CommandLineIcon className="h-6 w-6" />}
          />
          <FeatureCard
            title="Smart code generation"
            description="Combine predictable generators with AI intelligence for consistent, tested scaffolding with contextual customization."
            href="https://youtu.be/Cbc9_W5J6DA"
            icon={
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
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
            }
          />
          <FeatureCard
            title="Documentation-aware assistance"
            description="Always up-to-date, never hallucinating with live access to current Nx documentation and context-aware configuration guidance."
            href="/blog/nx-made-cursor-smarter"
            icon={
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 6L14 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6 10H18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13 14H18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13 18H18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 21.4V2.6C2 2.26863 2.26863 2 2.6 2H21.4C21.7314 2 22 2.26863 22 2.6V21.4C22 21.7314 21.7314 22 21.4 22H2.6C2.26863 22 2 21.7314 2 21.4Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M6 18V14L8 16L10 14V18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
          <FeatureCard
            title="Architectural awareness"
            description="Move from file-level to workspace-level understanding with team ownership identification and technology stack analysis."
            href="/blog/nx-and-ai-why-they-work-together"
            icon={
              <svg
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="5"
                  cy="5"
                  r="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="19"
                  cy="5"
                  r="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="5"
                  cy="19"
                  r="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="19"
                  cy="19"
                  r="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path d="M7 5H17" stroke="currentColor" strokeWidth="2" />
                <path d="M5 7V17" stroke="currentColor" strokeWidth="2" />
                <path d="M7 19H17" stroke="currentColor" strokeWidth="2" />
                <path d="M19 7V17" stroke="currentColor" strokeWidth="2" />
              </svg>
            }
          />
        </div>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: JSX.Element;
  href?: string;
}

function FeatureCard({
  title,
  description,
  icon,
  href = '#',
}: FeatureCardProps): ReactElement {
  return (
    <a href={href} className="block h-full transform-gpu">
      <div
        className={cx(
          'group relative h-full w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-6',
          'dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:shadow-blue-900/20',
          'before:absolute before:inset-0 before:z-0 before:bg-gradient-to-br before:from-blue-50 before:to-transparent before:opacity-0 before:transition-opacity',
          'transition-all duration-300 ease-out',
          'hover:-translate-y-2 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/50',
          'hover:before:opacity-100 dark:before:from-blue-950'
        )}
      >
        <div className="relative z-10">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-transform duration-300 group-hover:scale-110 dark:bg-slate-800 dark:text-blue-400 dark:group-hover:bg-blue-900">
            {icon}
          </div>
          <h3 className="mb-2 text-lg font-medium">{title}</h3>
          <p className="text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
    </a>
  );
}
