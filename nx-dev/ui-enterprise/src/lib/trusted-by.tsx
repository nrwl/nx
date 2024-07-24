import {
  AwsIcon,
  BillColoredIcon,
  CapitalOneIcon,
  CaterpillarIcon,
  CiscoIcon,
  FicoIcon,
  HiltonIcon,
  ManIcon,
  ReactQueryIcon,
  RedwoodJsIcon,
  RoyalBankOfCanadaColoredIcon,
  SevenElevenColoredIcon,
  ShopifyIcon,
  StorybookIcon,
  VmwareIcon,
} from '@nx/nx-dev/ui-icons';
import { motion } from 'framer-motion';

export function TrustedBy(): JSX.Element {
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

  return (
    <section className="">
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
        {/*<div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-xl">*/}
        {/*  <SectionHeading as="h2" variant="title" id="trusted-by">*/}
        {/*    Trusted by startups and Fortune 500 companies*/}
        {/*  </SectionHeading>*/}
        {/*</div>*/}
        <motion.dl
          initial="hidden"
          variants={variants}
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-4 grid grid-cols-2 gap-0.5 md:grid-cols-5"
        >
          <motion.div
            custom={1}
            variants={itemVariants}
            className="col-span-1 flex items-center justify-center"
          >
            <AwsIcon className="h-14 w-14 text-black dark:text-white" />
          </motion.div>
          <motion.div
            custom={2}
            variants={itemVariants}
            className="col-span-1 flex h-14 items-center justify-center lg:h-28"
          >
            <ManIcon aria-hidden="true" className="h-14 w-14 text-[#E40045]" />
          </motion.div>
          <motion.div
            custom={3}
            variants={itemVariants}
            className="col-span-1 flex h-14 items-center justify-center lg:h-28"
          >
            <CapitalOneIcon
              aria-hidden="true"
              className="h-28 w-28 text-black dark:text-white"
            />
          </motion.div>
          <motion.div
            custom={4}
            variants={itemVariants}
            className="col-span-1 flex h-14 items-center justify-center lg:h-28"
          >
            <ShopifyIcon
              aria-hidden="true"
              className="h-12 w-12 text-[#7AB55C]"
            />
          </motion.div>
          <motion.div
            custom={5}
            variants={itemVariants}
            className="col-span-1 flex h-14 items-center justify-center lg:h-28"
          >
            <RoyalBankOfCanadaColoredIcon
              aria-hidden="true"
              className="h-14 w-14"
            />
          </motion.div>
          <motion.div
            custom={6}
            variants={itemVariants}
            className="col-span-1 flex h-14 items-center justify-center lg:h-28"
          >
            <VmwareIcon
              aria-hidden="true"
              className="h-28 w-28 text-black dark:text-white"
            />
          </motion.div>
          <motion.div
            custom={7}
            variants={itemVariants}
            className="col-span-1 flex h-14 items-center justify-center lg:h-28"
          >
            <StorybookIcon
              aria-hidden="true"
              className="h-12 w-12 text-[#FF4785]"
            />
          </motion.div>
          <motion.div
            custom={8}
            variants={itemVariants}
            className="col-span-1 flex h-14 items-center justify-center lg:h-28"
          >
            <FicoIcon aria-hidden="true" className="h-28 w-28 text-[#0A6DE6]" />
          </motion.div>
          <motion.div
            custom={9}
            variants={itemVariants}
            className="col-span-1 flex h-14 items-center justify-center lg:h-28"
          >
            <CaterpillarIcon
              aria-hidden="true"
              className="h-14 w-14 text-[#FFCD11]"
            />
          </motion.div>
          <motion.div
            custom={10}
            variants={itemVariants}
            className="col-span-1 flex items-center justify-center"
          >
            <CiscoIcon
              aria-hidden="true"
              className="h-20 w-20 text-[#1BA0D7]"
            />
          </motion.div>
          <motion.div
            custom={11}
            variants={itemVariants}
            className="col-span-1 flex items-center justify-center"
          >
            <BillColoredIcon aria-hidden="true" className="h-14 w-14" />
          </motion.div>
          <motion.div
            custom={12}
            variants={itemVariants}
            className="col-span-1 flex items-center justify-center"
          >
            <SevenElevenColoredIcon aria-hidden="true" className="h-14 w-14" />
          </motion.div>
          <motion.div
            custom={13}
            variants={itemVariants}
            className="col-span-1 flex items-center justify-center"
          >
            <HiltonIcon
              aria-hidden="true"
              className="h-20 w-20 text-black dark:text-white"
            />
          </motion.div>
          <motion.div
            custom={14}
            variants={itemVariants}
            className="col-span-1 flex items-center justify-center"
          >
            <RedwoodJsIcon
              aria-hidden="true"
              className="h-14 w-14 text-[#BF4722]"
            />
          </motion.div>
          <motion.div
            custom={14}
            variants={itemVariants}
            className="col-span-1 flex items-center justify-center"
          >
            <ReactQueryIcon
              aria-hidden="true"
              className="h-14 w-14 text-[#FF4154]"
            />
          </motion.div>
          {/*<motion.div*/}
          {/*  custom={11}*/}
          {/*  variants={itemVariants}*/}
          {/*  className="col-span-1 flex items-center justify-center"*/}
          {/*>*/}
          {/*  <AmericanAirlinesIcon*/}
          {/*    aria-hidden="true"*/}
          {/*    className="h-12 w-12 text-[#0071CE]"*/}
          {/*  />*/}
          {/*</motion.div>*/}
        </motion.dl>
      </div>
    </section>
  );
}
