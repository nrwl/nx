import { Input } from '@headlessui/react';
import { Button, SectionHeading } from '@nx/nx-dev/ui-common';
import { Layout } from '@nx/nx-dev/ui-company';
import { NextSeo } from 'next-seo';
import { useMemo, useRef, useState } from 'react';

function ValueInput({
  id,
  value,
  setValue,
  label,
  placeholder,
  subtitle,
}: {
  id: string;
  value: number;
  setValue: (value: number) => void;
  label: string;
  placeholder: string;
  subtitle: string;
}) {
  return (
    <div className="basis-1/3">
      <div className="flex flex-col">
        <label htmlFor={id}>{label}</label>
        <p className="text-xs text-slate-500">{subtitle}</p>
        <Input
          id={id}
          className="relative mx-auto my-2 flex max-w-3xl gap-2 rounded-md border border-slate-300 bg-white px-2 shadow-lg dark:border-slate-900 dark:bg-slate-700"
          type="number"
          value={value}
          onChange={(e) => setValue(parseInt(e.target.value))}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function ValueRange({
  id,
  value,
  setValue,
  label,
  min,
  max,
  subtitle,
}: {
  id: string;
  value: number;
  setValue: (value: number) => void;
  label: string;
  min: number;
  max: number;
  subtitle: string;
}) {
  return (
    <div className="basis-1/3">
      <div className="flex flex-col">
        <label htmlFor={id}>{label}</label>
        <p className="text-xs text-slate-500">{subtitle}</p>
        <Input
          id={id}
          className="relative mx-auto my-2 flex max-w-3xl gap-2 rounded-md border border-slate-300 bg-white dark:border-slate-900 dark:bg-slate-700"
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => setValue(parseInt(e.target.value))}
        />
        <p className="text-sm text-slate-500">{value}%</p>
      </div>
    </div>
  );
}

function ValueLevers({
  setValueCreated,
}: {
  setValueCreated: (valueCreated: { hours: number; dollars: number }) => void;
}): JSX.Element {
  const [developerSalary, setDeveloperSalary] = useState<number>(125000);
  const [medianBuildTime, setMedianBuildTime] = useState<number>(30);
  const [monthlyCIPEs, setMonthlyCIPEs] = useState<number>(10000);
  const [longestBuildTime, setLongestBuildTime] = useState<number>(60); // currently unused
  const [percentageOfCIPEs15Minutes, setPercentageOfCIPEs15Minutes] =
    useState<number>(0);
  const [flakyPercentage, setFlakyPercentage] = useState<number>(0);

  const formRef = useRef<HTMLFormElement>(null);
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // dte savings
    const medianBuildHours = medianBuildTime / 60;
    const totalCIPEsPerMonth = monthlyCIPEs;
    const dteSavingsPercentage = 0.2; // hard coded to 20%
    const hoursSaved =
      medianBuildHours * totalCIPEsPerMonth * dteSavingsPercentage;
    const fteHoursLost = hoursSaved / 160;
    const fteSavings = fteHoursLost * (developerSalary / 12);

    // context switching savings https://erichorvitz.com/taskdiary.pdf
    const totalContextSwitches =
      (percentageOfCIPEs15Minutes / 100) * monthlyCIPEs;
    const hoursLostPerCS = 0.3;
    const csHoursLost = hoursLostPerCS * totalContextSwitches;
    const csFTELost = csHoursLost / 160;
    const csFTESavings = csFTELost * (developerSalary / 12);

    // flaky percentage
    const totalFlakyCIPEs = (flakyPercentage / 100) * monthlyCIPEs;
    const flakyLostCIPEHours = medianBuildTime / 60;
    const flakyLostHours = flakyLostCIPEHours * totalFlakyCIPEs;
    const flakyFTELost = flakyLostHours / 160;
    const flakyFTESavings = flakyFTELost * (developerSalary / 12);

    setValueCreated({
      hours:
        Math.trunc(hoursSaved) +
        Math.trunc(csHoursLost) +
        Math.trunc(flakyLostHours),
      dollars:
        Math.trunc(fteSavings) +
        Math.trunc(csFTESavings) +
        Math.trunc(flakyFTESavings),
    });
  };

  return (
    <div>
      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="my-8 flex flex-wrap gap-y-4">
          <ValueInput
            id="developer-salary"
            value={developerSalary}
            setValue={setDeveloperSalary}
            label="Average Engineer Salary"
            placeholder="$125,000"
            subtitle="in USD"
          />
          <ValueInput
            id="median-build-time"
            value={medianBuildTime}
            setValue={setMedianBuildTime}
            label="Median Build Time"
            placeholder="30 minutes"
            subtitle="in minutes"
          />
          <ValueInput
            id="monthly-cipe"
            value={monthlyCIPEs}
            setValue={setMonthlyCIPEs}
            label="Monthly Workflows"
            placeholder="10,000"
            subtitle="CI Pipeline Executions"
          />
          <ValueInput
            id="longest-build-time"
            value={longestBuildTime}
            setValue={setLongestBuildTime}
            label="Longest Build Time"
            placeholder="45"
            subtitle="in minutes"
          />

          <ValueRange
            id="percentage-of-cipe-15-minutes"
            value={percentageOfCIPEs15Minutes}
            setValue={setPercentageOfCIPEs15Minutes}
            label="Pipeline's > 15 Minutes"
            min={0}
            max={100}
            subtitle="in percentage"
          />

          <ValueRange
            id="flaky-percentage"
            value={flakyPercentage}
            setValue={setFlakyPercentage}
            label="Flaky Workflows"
            min={0}
            max={100}
            subtitle="in percentage"
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
  const [valueCreated, setValueCreated] = useState<{
    hours: number;
    dollars: number;
  }>({ hours: 0, dollars: 0 });
  const formattedDollarsCreated = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(valueCreated.dollars),
    [valueCreated.dollars]
  );
  const formattedHoursSaved = useMemo(() => {
    const days = Math.floor(valueCreated.hours / 24);
    const formattedDays =
      days > 0
        ? `${days} ${days === 1 ? 'day' : 'days'}${days > 1 ? ', ' : ''}`
        : '';
    const hours = valueCreated.hours % 24;
    const formattedHours =
      hours > 0 ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '';
    return `${formattedDays} ${formattedHours}`;
  }, [valueCreated.hours]);
  const fteGained = useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(valueCreated.hours / 160);
  }, [valueCreated.hours]);

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
          {valueCreated.dollars > 0 && (
            <>
              <SectionHeading
                as="h4"
                variant="subtitle"
                className="mx-auto mt-6 max-w-3xl"
              >
                Monthly Value Created
              </SectionHeading>
              <SectionHeading
                as="h3"
                variant="title"
                className="mx-auto max-w-3xl"
              >
                {formattedDollarsCreated}
              </SectionHeading>

              <SectionHeading
                as="h4"
                variant="subtitle"
                className="mx-auto mt-6 max-w-3xl"
              >
                Time Saved
              </SectionHeading>
              <SectionHeading
                as="h3"
                variant="title"
                className="mx-auto max-w-3xl"
              >
                {formattedHoursSaved}
              </SectionHeading>
              <SectionHeading
                as="h4"
                variant="subtitle"
                className="mx-auto mt-6 max-w-3xl"
              >
                Full Time Engineers Gained
              </SectionHeading>
              <SectionHeading
                as="h3"
                variant="title"
                className="mx-auto max-w-3xl"
              >
                {fteGained}
              </SectionHeading>
            </>
          )}
        </div>
      </Layout>
    </>
  );
}

export default ValueCalculator;
