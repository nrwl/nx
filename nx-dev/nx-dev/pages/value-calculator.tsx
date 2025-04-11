import { Input } from '@headlessui/react';
import { Button, SectionHeading } from '@nx/nx-dev/ui-common';
import { Layout } from '@nx/nx-dev/ui-company';
import { NextSeo } from 'next-seo';
import { useMemo, useRef, useState } from 'react';

function DeveloperSalary({
  developerSalary,
  setDeveloperSalary,
}: {
  developerSalary: number;
  setDeveloperSalary: (developerSalary: number) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <label htmlFor="developer-salary">Average Engineer Salary</label>
      <Input
        id="developer-salary"
        className="relative mx-auto my-2 flex max-w-3xl gap-2 rounded-md border border-slate-300 bg-white px-2 shadow-lg dark:border-slate-900 dark:bg-slate-700"
        type="number"
        value={developerSalary}
        onChange={(e) => setDeveloperSalary(parseInt(e.target.value))}
        placeholder="$125,000"
      />
    </div>
  );
}

function MedianBuildTime({
  medianBuildTime,
  setMedianBuildTime,
}: {
  medianBuildTime: number;
  setMedianBuildTime: (medianBuildTime: number) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <label htmlFor="median-build-time">Median Build Time</label>
      <Input
        id="median-build-time"
        className="relative mx-auto my-2 flex max-w-3xl gap-2 rounded-md border border-slate-300 bg-white px-2 shadow-lg dark:border-slate-900 dark:bg-slate-700"
        type="text"
        placeholder="30 minutes"
        value={medianBuildTime}
        onChange={(e) => setMedianBuildTime(parseInt(e.target.value))}
      />
    </div>
  );
}

function MonthlyCIPEs({
  monthlyCIPEs,
  setMonthlyCIPEs,
}: {
  monthlyCIPEs: number;
  setMonthlyCIPEs: (monthlyCIPEs: number) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <label htmlFor="number-of-engineers">
        Monthly CI Pipeline Executions
      </label>
      <Input
        id="monthly-cipe"
        className="relative mx-auto my-2 flex max-w-3xl gap-2 rounded-md border border-slate-300 bg-white px-2 shadow-lg dark:border-slate-900 dark:bg-slate-700"
        type="number"
        placeholder="10,000"
        value={monthlyCIPEs}
        onChange={(e) => setMonthlyCIPEs(parseInt(e.target.value))}
      />
    </div>
  );
}

function DteSavings({
  dteSavings,
  setDteSavings,
}: {
  dteSavings: number;
  setDteSavings: (dteSavings: number) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <label htmlFor="dte-savings">DTE Savings</label>
      <Input
        id="dte-savings"
        className="relative mx-auto my-2 flex max-w-3xl gap-2 rounded-md border border-slate-300 bg-white px-2 dark:border-slate-900 dark:bg-slate-700"
        type="range"
        min={10}
        max={30}
        value={dteSavings}
        onChange={(e) => setDteSavings(parseInt(e.target.value))}
      />
      <p className="text-sm text-slate-500">{dteSavings}%</p>
    </div>
  );
}

function ContextSwitching({
  percentageOfCIPEs15Minutes,
  setPercentageOfCIPEs15Minutes,
}: {
  percentageOfCIPEs15Minutes: number;
  setPercentageOfCIPEs15Minutes: (percentageOfCIPEs15Minutes: number) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <label htmlFor="context-switching-savings">
        % of Pipeline's {'>'} 15 Minutes
      </label>
      <Input
        id="context-switching-savings"
        className="relative mx-auto my-2 flex max-w-3xl gap-2 rounded-md border border-slate-300 bg-white px-2 dark:border-slate-900 dark:bg-slate-700"
        type="range"
        min={0}
        max={100}
        value={percentageOfCIPEs15Minutes}
        onChange={(e) =>
          setPercentageOfCIPEs15Minutes(parseInt(e.target.value))
        }
      />
      <p className="text-sm text-slate-500">{percentageOfCIPEs15Minutes}%</p>
    </div>
  );
}

function FlakyPercentage({
  flakyPercentage,
  setFlakyPercentage,
}: {
  flakyPercentage: number;
  setFlakyPercentage: (flakyPercentage: number) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <label htmlFor="flaky-percentage">Flaky Percentage</label>
      <Input
        id="flaky-percentage"
        className="relative mx-auto my-2 flex max-w-3xl gap-2 rounded-md border border-slate-300 bg-white px-2 dark:border-slate-900 dark:bg-slate-700"
        type="range"
        min={0}
        max={100}
        value={flakyPercentage}
        onChange={(e) => setFlakyPercentage(parseInt(e.target.value))}
      />
      <p className="text-sm text-slate-500">{flakyPercentage}%</p>
    </div>
  );
}
function ValueLevers({
  setValueCreated,
}: {
  setValueCreated: (valueCreated: number) => void;
}): JSX.Element {
  const [developerSalary, setDeveloperSalary] = useState<number>(125000);
  const [medianBuildTime, setMedianBuildTime] = useState<number>(30);
  const [monthlyCIPEs, setMonthlyCIPEs] = useState<number>(10000);
  const [dteSavings, setDteSavings] = useState<number>(20);
  const [percentageOfCIPEs15Minutes, setPercentageOfCIPEs15Minutes] =
    useState<number>(0);
  const [flakyPercentage, setFlakyPercentage] = useState<number>(0);

  const formRef = useRef<HTMLFormElement>(null);
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // dte savings
    const medianBuildHours = medianBuildTime / 60;
    const totalCIPEsPerMonth = monthlyCIPEs;
    const dteSavingsPercentage = dteSavings / 100;
    const hoursSaved =
      medianBuildHours * totalCIPEsPerMonth * dteSavingsPercentage;
    const fteHoursLost = hoursSaved / 160;
    const fteSavings = fteHoursLost * (developerSalary / 12);

    // context switching savings https://erichorvitz.com/taskdiary.pdf
    const totalContextSwitches =
      (percentageOfCIPEs15Minutes / 100) * monthlyCIPEs;
    const hoursLostPerCS = 0.3; // defaults to 15 minutes
    const csHoursLost = hoursLostPerCS * totalContextSwitches;
    const csFTELost = csHoursLost / 160;
    const csFTESavings = csFTELost * (developerSalary / 12);

    // flaky percentage
    const totalFlakyCIPEs = (flakyPercentage / 100) * monthlyCIPEs;
    const flakyLostCIPEHours = medianBuildTime / 60;
    const flakyLostHours = flakyLostCIPEHours * totalFlakyCIPEs;
    const flakyFTELost = flakyLostHours / 160;
    const flakyFTESavings = flakyFTELost * (developerSalary / 12);
    setValueCreated(
      Math.trunc(fteSavings) +
        Math.trunc(csFTESavings) +
        Math.trunc(flakyFTESavings)
    );
  };

  return (
    <div>
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="my-8 flex justify-between">
          <DeveloperSalary
            developerSalary={developerSalary}
            setDeveloperSalary={setDeveloperSalary}
          />
          <MedianBuildTime
            medianBuildTime={medianBuildTime}
            setMedianBuildTime={setMedianBuildTime}
          />
          <MonthlyCIPEs
            monthlyCIPEs={monthlyCIPEs}
            setMonthlyCIPEs={setMonthlyCIPEs}
          />
        </div>
        <div className="my-8 flex justify-between">
          <DteSavings dteSavings={dteSavings} setDteSavings={setDteSavings} />
          <ContextSwitching
            percentageOfCIPEs15Minutes={percentageOfCIPEs15Minutes}
            setPercentageOfCIPEs15Minutes={setPercentageOfCIPEs15Minutes}
          />
          <FlakyPercentage
            flakyPercentage={flakyPercentage}
            setFlakyPercentage={setFlakyPercentage}
          />
        </div>
        <Button type="submit" variant="primary">
          Calculate
        </Button>
      </form>
    </div>
  );
}

export function ValueCalculator(): JSX.Element {
  const [valueCreated, setValueCreated] = useState<number>(0);
  const formattedValueCreated = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(valueCreated),
    [valueCreated]
  );
  return (
    <>
      <NextSeo
        title="Value Calculator"
        description="Value Calculator"
        openGraph={{
          title: 'Value Calculator',
          description: 'Value Calculator',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Monorepos · Fast CI',
              type: 'image/jpeg',
            },
          ],
          siteName: 'Nx',
          type: 'website',
        }}
      />
      <Layout>
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading
            as="h1"
            variant="display"
            className="mb-8 scroll-mt-24 font-medium tracking-tight text-slate-950 sm:text-3xl dark:text-white"
          >
            Value Calculator
          </SectionHeading>
          <p className="text-xs text-slate-500">
            Use this calculator to explore a hypothetical estimate of the time
            and cost savings your team could achieve by adopting Nx and Nx
            Cloud. By entering a few key details about your organization, you’ll
            get a high-level projection of the potential impact on productivity,
            collaboration, and CI efficiency. Please note: These figures are
            rough estimates based on internal benchmarks and customer feedback.
            Actual results may vary depending on your specific environment, team
            practices, and usage.
          </p>
          <ValueLevers setValueCreated={setValueCreated} />
          <SectionHeading
            as="h4"
            variant="subtitle"
            className="mx-auto mt-6 max-w-3xl"
          >
            {valueCreated > 0 && `Monthly Value Created:`}
          </SectionHeading>
          <SectionHeading as="h3" variant="title" className="mx-auto max-w-3xl">
            {formattedValueCreated}
          </SectionHeading>
        </div>
      </Layout>
    </>
  );
}

export default ValueCalculator;
