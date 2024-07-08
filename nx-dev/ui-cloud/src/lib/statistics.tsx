import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { SectionHeading } from './elements/section-tags';

/**
 * Calculate the total number of years worth of compute.
 *
 * @param {number} millis - The total number of seconds.
 * @return {number} The total number of years.
 */
function getTotalYears(millis: number): number {
  /**
   * The number of millis in a year is approximately:
   * 86 400 000 millis/day * 365.25 days/year ≈ 31 557 600 000 seconds/year.
   */
  const yearMillis = Number(31557600000);
  return Math.round(millis / yearMillis);
}

/**
 * Fetches the time saved from a remote API.
 *
 * @returns {Promise} A promise that resolves to an object containing the time saved data.
 * @returns {Date} The date the time saved data was retrieved.
 * @returns {number} The time saved in the last 7 days.
 * @returns {number} The time saved in the last 30 days.
 * @returns {number} The time's saved since the start.
 */
function fetchTimeSaved(): Promise<{
  date: Date;
  last7days: number;
  last30days: number;
  sinceStart: number;
}> {
  const apiUrl = 'https://cloud.nx.app/time-saved';

  return fetch(apiUrl)
    .then(
      (response) =>
        response.json() as Promise<{
          date: Date;
          last7days: number;
          last30days: number;
          sinceStart: number;
        }>
    )
    .catch(() => ({
      date: new Date(),
      last7days: Math.round(Math.random() * 1000000000),
      last30days: Math.round(Math.random() * 100000000000),
      sinceStart: Math.round(Math.random() * 10000000000000),
    }));
}

const stats = [
  {
    id: 1,
    name: 'Developers using Nx',
    value: 2,
    suffix: 'M+',
  },
  {
    id: 3,
    name: 'Active workspaces',
    value: '4k',
    suffix: '+',
  },
  { id: 2, name: 'Compute time saved', value: 800, suffix: '+ years' },
  { id: 4, name: 'Runs daily', value: 100, suffix: 'k+' },
];

export function Statistics(): JSX.Element {
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
        delay: i * 0.25,
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
  const [timeSaved, setTimeSaved] = useState<number>(800);

  useEffect(() => {
    let ignore = false;
    fetchTimeSaved().then((data) => {
      if (!ignore) {
        setTimeSaved(getTotalYears(data.sinceStart));
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl">
        <SectionHeading as="h2" variant="title" id="statistics">
          Trusted by startups and Fortune 500 companies
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Nx Cloud provides plans for open source projects, startups, and large
          enterprises.
        </SectionHeading>
      </div>
      <motion.dl
        initial="hidden"
        variants={variants}
        whileInView="visible"
        viewport={{ once: true }}
        className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-10 text-slate-950 sm:mt-20 sm:grid-cols-2 sm:gap-y-16 lg:mx-0 lg:max-w-none lg:grid-cols-4 dark:text-white"
      >
        {stats.map((stat, idx) => (
          <motion.div
            key={`statistic-${idx}`}
            custom={idx}
            variants={itemVariants}
            className="flex flex-col gap-y-3 border-l border-black/10 pl-6 dark:border-white/10"
          >
            <dt className="text-sm leading-6 text-slate-600 dark:text-slate-500">
              {stat.name}
            </dt>
            <dd className="order-first text-3xl font-semibold tracking-tight">
              {stat.name === 'Compute time saved' ? timeSaved : stat.value}
              {stat.suffix}
            </dd>
          </motion.div>
        ))}
      </motion.dl>
    </section>
  );
}
