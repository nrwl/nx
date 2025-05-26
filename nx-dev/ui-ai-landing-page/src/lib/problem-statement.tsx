import { SectionHeading } from '@nx/nx-dev/ui-common';

export interface ProblemStatementProps {
  className?: string;
}

export function ProblemStatement({
  className,
}: ProblemStatementProps): JSX.Element {
  return (
    <section className={`py-12 ${className || ''}`}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 text-left">
          <SectionHeading as="h2" variant="title">
            Your AI assistant is blind to your workspace architecture
          </SectionHeading>

          <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">
            As monorepos scale, AI tools become progressively less effective
            without true workspace understanding.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
          {/* Left Column - Problems */}
          <div>
            <h3 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">
              The challenges
            </h3>

            <div className="space-y-4">
              <div className="flex items-start">
                <div className="mr-3 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-blue-600 dark:text-blue-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <circle cx="5" cy="5" r="2" />
                    <circle cx="19" cy="5" r="2" />
                    <circle cx="5" cy="19" r="2" />
                    <circle cx="19" cy="19" r="2" />
                    <path d="M7 5H17" />
                    <path d="M5 7V17" />
                    <path d="M7 19H17" />
                    <path d="M19 7V17" />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                    Limited context
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    LLMs only see individual files, missing the architectural
                    relationships in large monorepos.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="mr-3 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-blue-600 dark:text-blue-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path d="M14 3V7C14 7.55228 14.4477 8 15 8H19" />
                    <path d="M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H14L19 8V19C19 20.1046 18.1046 21 17 21Z" />
                    <path d="M9 17H15" />
                    <path d="M9 13H15" />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                    Inconsistent output
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    AI generates code that doesn't follow team standards or may
                    break components it can't see.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="mr-3 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-blue-600 dark:text-blue-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <circle cx="12" cy="8" r="3" />
                    <circle cx="6" cy="16" r="2" />
                    <circle cx="18" cy="16" r="2" />
                    <path d="M9.5 9.5L7 14" strokeLinecap="round" />
                    <path d="M14.5 9.5L17 14" strokeLinecap="round" />
                    <path d="M8 16L16 16" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                    No workspace awareness
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    AI can't understand project dependencies, ownership, or
                    cross-project integration points.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="mr-3 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-blue-600 dark:text-blue-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path
                      d="M6 10L10 14L6 18"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M12 18H18" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                    Manual context burden
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Developers must repeatedly provide the same contextual
                    information about project structure.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Solutions */}
          <div>
            <h3 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">
              How Nx helps
            </h3>

            <div className="space-y-4">
              <div className="flex items-start">
                <div className="mr-3 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-green-600 dark:text-green-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <circle cx="5" cy="5" r="2" />
                    <circle cx="19" cy="5" r="2" />
                    <circle cx="5" cy="19" r="2" />
                    <circle cx="19" cy="19" r="2" />
                    <path d="M7 5H17" />
                    <path d="M5 7V17" />
                    <path d="M7 19H17" />
                    <path d="M19 7V17" />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                    Architectural awareness
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Move from file-level to workspace-level understanding with
                    rich project relationship metadata.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="mr-3 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-green-600 dark:text-green-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path d="M14 3V7C14 7.55228 14.4477 8 15 8H19" />
                    <path d="M17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3H14L19 8V19C19 20.1046 18.1046 21 17 21Z" />
                    <path d="M9 17H15" />
                    <path d="M9 13H15" />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                    Predictable + intelligent
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Combine consistent generators with AI customization that
                    follows team standards.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="mr-3 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-green-600 dark:text-green-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path
                      d="M12 2L2 7L12 12L22 7L12 2Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 17L12 22L22 17"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 12L12 17L22 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                    Integrated workflows
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Connect editor, terminal, CI, and AI for truly context-aware
                    assistance across your entire workspace.
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="mr-3 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-green-600 dark:text-green-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path
                      d="M6 6L14 6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 10H18"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13 14H18"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13 18H18"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M2 21.4V2.6C2 2.26863 2.26863 2 2.6 2H21.4C21.7314 2 22 2.26863 22 2.6V21.4C22 21.7314 21.7314 22 21.4 22H2.6C2.26863 22 2 21.7314 2 21.4Z" />
                    <path
                      d="M6 18V14L8 16L10 14V18"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                    Up-to-Date Documentation
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Access current docs and best practices for accurate,
                    workspace-specific guidance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
