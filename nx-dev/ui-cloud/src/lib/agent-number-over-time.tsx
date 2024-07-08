import { SectionHeading } from './elements/section-tags';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
interface Agent {
  date: string;
  available: number;
  used: number;
}
function generateAgents(): Agent[] {
  const items: { date: string; available: number; used: number }[] = [];
  for (let i = 1; i <= 30; i++) {
    const used = Math.floor(Math.random() * 81); // Random percentage from 0 to 80
    const available =
      used + Math.floor(Math.random() * (100 - used - 20 + 1) + 20); // Random percentage that is at least 20 more than "used"
    items.push({ date: `Aug ${String(i).padStart(2, '0')}`, available, used });
  }

  for (let i = 1; i <= 30; i++) {
    const available = Math.floor(Math.random() * (41 - 5)) + 5; // Random percentage from 5 to 41
    const lowerBound = available * 0.98; // Lower bound of the 2% error range
    const used =
      Math.floor(Math.random() * (available - lowerBound)) + lowerBound;
    items.push({ date: `Aug ${String(i).padStart(2, '0')}`, available, used });
  }
  return items;
}

export function AgentNumberOverTime(): JSX.Element {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    let ignore = false;
    if (!ignore) setAgents(generateAgents());
    return () => {
      ignore = true;
    };
  }, []);

  // Set total number of items and gaps
  const totalGaps = agents.length - 1;
  // Set gap width in percent
  const gapWidthPercent = 0.3;
  // Calculate total width of gaps
  const totalGapWidthPercent = totalGaps * gapWidthPercent;
  // Calculate the remaining length for items
  const remainingPercent = 100 - totalGapWidthPercent;
  // Calculate the width of each item
  const itemWidthPercent = remainingPercent / agents.length;

  const variants = {
    hidden: {
      opacity: 0,
      transition: {
        when: 'afterChildren',
      },
    },
    visible: (i: number) => ({
      opacity: 1,
      transition: {
        delay: i || 0,
      },
    }),
  };
  const itemVariants = {
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.035,
        duration: 0.65,
        ease: 'easeOut',
        when: 'beforeChildren',
        staggerChildren: 0.3,
      },
    }),
    hidden: {
      opacity: 0,
      y: 4,
      transition: {
        when: 'afterChildren',
      },
    },
  };

  return (
    <section id="agent-number-over-time" className="overflow-hidden">
      <div className="mx-auto max-w-7xl md:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeading
            as="h2"
            variant="title"
            id="optimize-agent-utilization"
          >
            Optimize agent utilization <br /> Save money
          </SectionHeading>
          <SectionHeading as="p" variant="subtitle" className="mt-6">
            Nx Cloud uses historical data and models to optimize the utilization
            of your agents.
          </SectionHeading>
        </div>
        <motion.div
          initial="hidden"
          variants={variants}
          whileInView="visible"
          viewport={{ once: true }}
          className="relative mt-16 w-full rounded-md border border-slate-100 bg-white p-4 sm:mt-20 dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="mt-2 text-base font-medium">
            Number of idle agents VS used agents over time
          </div>
          <div className="flex justify-end gap-3 text-xs">
            <div className="flex items-center gap-1">
              <span className="m-1 h-2.5 w-2.5 flex-none rounded-full bg-blue-500" />
              Available agents count
            </div>
            <div className="flex items-center gap-1">
              <span className="m-1 h-2.5 w-2.5 flex-none rounded-full bg-green-500" />
              Used agents count
            </div>
          </div>
          <div className="mt-2 text-xs">Agents count</div>
          <div
            className="mt-1 flex h-56 flex-row items-end space-y-1 border-b border-l border-slate-200 p-1 dark:border-slate-700"
            style={{ gap: gapWidthPercent + '%' }}
          >
            {agents.map((i, idx) => (
              <motion.div
                custom={idx}
                variants={itemVariants}
                key={`without-agents-${i.available}-${idx}`}
                data-tooltip={`${Math.round(i.available - i.used)} agents idle`}
                className="relative flex h-full flex-col-reverse"
                style={{ width: itemWidthPercent + '%' }}
              >
                <motion.div
                  custom={idx}
                  variants={itemVariants}
                  className="absolute inset-x-0 bottom-0 w-full rounded-sm bg-blue-500"
                  style={{
                    height: i.available + '%',
                  }}
                />
                <motion.div
                  custom={idx + 1}
                  variants={itemVariants}
                  className="absolute inset-x-0 bottom-0 w-full bg-green-500"
                  style={{ height: i.used + '%' }}
                />
              </motion.div>
            ))}
          </div>
          <div className="mt-1 flex flex-row justify-between text-xs">
            <span>Time</span>
            <span>Day 1</span>
            <span>Day 2</span>
            <span>Day 3</span>
            <span>Day 4</span>
            <span>Day 5</span>
            <span>Day 6</span>
            <span>Day 7</span>
            <span>Day 8</span>
            <span>Day 9</span>
            <span>Day 10</span>
          </div>
          <motion.div
            custom={4}
            variants={variants}
            className="absolute left-1/2 top-1/2 flex h-12 w-auto flex-row items-center gap-2"
          >
            <svg
              aria-hidden="true"
              role="img"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="mt-4 h-8 w-8 -rotate-[18deg] transform text-slate-600 dark:text-slate-400"
            >
              <path d="M.348 12.633a1.145 1.145 0 0 1 1.681 0l2.785 2.938c.466-5 3.975-9.317 8.877-10.346 3.608-.757 7.33.419 9.954 3.146.468.486.474 1.28.013 1.774-.46.494-1.213.5-1.68.014-2.064-2.143-4.988-3.068-7.823-2.473-3.873.813-6.64 4.239-6.98 8.194l3.078-3.247a1.145 1.145 0 0 1 1.681 0c.464.49.464 1.284 0 1.774l-4.952 5.226a1.154 1.154 0 0 1-.84.367c-.305 0-.61-.122-.841-.367L.348 14.407a1.304 1.304 0 0 1 0-1.774Z" />
            </svg>
            <span className="inline-flex cursor-default items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10 dark:bg-slate-400/10 dark:text-slate-400 dark:ring-slate-400/20">
              Nx Cloud enabled
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
