import React, { ReactComponentElement, useEffect } from 'react';
import Link from 'next/link';
import { motion, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import cx from 'classnames';

export function OpenSourceProjects(): ReactComponentElement<any> {
  const projectList = [
    {
      title: 'Storybook',
      href: 'https://github.com/storybookjs/storybook',
      description:
        'The UI component explorer. Develop, document, & test React, Vue, Angular, Web Components, Ember, Svelte & more!',
      icon: (
        <svg
          className="w-10 h-auto text-[#FF4785]"
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M16.71.243l-.12 2.71a.18.18 0 00.29.15l1.06-.8.9.7a.18.18 0 00.28-.14l-.1-2.76 1.33-.1a1.2 1.2 0 011.279 1.2v21.596a1.2 1.2 0 01-1.26 1.2l-16.096-.72a1.2 1.2 0 01-1.15-1.16l-.75-19.797a1.2 1.2 0 011.13-1.27L16.7.222zM13.64 9.3c0 .47 3.16.24 3.59-.08 0-3.2-1.72-4.89-4.859-4.89-3.15 0-4.899 1.72-4.899 4.29 0 4.45 5.999 4.53 5.999 6.959 0 .7-.32 1.1-1.05 1.1-.96 0-1.35-.49-1.3-2.16 0-.36-3.649-.48-3.769 0-.27 4.03 2.23 5.2 5.099 5.2 2.79 0 4.969-1.49 4.969-4.18 0-4.77-6.099-4.64-6.099-6.999 0-.97.72-1.1 1.13-1.1.45 0 1.25.07 1.19 1.87z" />
        </svg>
      ),
    },
    {
      title: 'FluentUi (Microsoft)',
      href: 'https://github.com/microsoft/fluentui',
      description:
        'Fluent UI web represents a collection of utilities, React components, and web components for building web applications.',
      icon: (
        <svg
          className="w-10 h-auto text-[#5E5E5E]"
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0 0v11.408h11.408V0zm12.594 0v11.408H24V0zM0 12.594V24h11.408V12.594zm12.594 0V24H24V12.594z" />
        </svg>
      ),
    },
    {
      title: 'NgRx',
      href: 'https://github.com/ngrx/platform',
      description: 'Reactive libraries for Angular.',
      icon: (
        <svg
          className="w-10 h-auto"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1000 1000"
        >
          <defs />
          <g
            id="badge"
            stroke="none"
            strokeWidth="1"
            fill="none"
            fillRule="evenodd"
          >
            <polygon
              id="Path-2"
              fill="#412846"
              points="500.96252 11 44 169.619503 109.419009 775.863609 500.96252 989.147518"
            />
            <polygon
              id="Path-2"
              fill="#4B314F"
              points="499 11 955.96252 169.619503 890.543511 775.863609 499 989.147518"
            />
            <path
              d="M727.748042,345.712306 L727.66634,345.452948 C748.53141,368.675743 759.248655,396.250955 759.818077,428.178583 C760.387499,460.10621 749.670253,493.785553 727.419362,529.113702 C744.049216,516.186231 763.254044,488.280572 784.970754,445.720993 C794.352489,531.973497 759.496406,597.488822 680.07676,642.358274 C705.433171,640.019987 739.098221,623.326102 780.852373,592.218304 C736.295204,699.492316 654.368246,756.091448 535.071499,762.0157 C419.779066,761.984828 345.090509,692.70063 345.149347,692.744623 C297.749003,655.853422 265.136294,609.356006 247.420657,553.461194 C219.071352,522.501468 218.788687,519.181412 215.864399,506.810213 C212.94011,494.439015 217.711589,490.983038 226.016225,478.877684 C231.552649,470.807448 232.857288,459.198337 230.012754,444.257657 C222.955013,434.470009 218.890643,419.140866 217.819642,398.270229 C217.819642,388.184149 224.550937,377.542369 238.013526,366.344888 C251.476116,355.147407 259.735587,346.535764 262.727877,340.60672 C265.010137,337.374281 265.891913,323.360897 265.373204,298.56657 C265.233841,274.213659 278.755317,260.964316 305.93763,258.818543 C346.7111,255.599883 369.705986,224.934529 382.516256,210.988846 C391.056436,201.691724 403.695194,197.172941 419.636711,197.086041 C442.079696,196.034098 462.499977,204.637166 480.091445,222.390999 C523.906033,220.124746 568.786858,231.940816 614.26226,257.53906 C678.886453,295.927519 714.155144,337.500002 720.068335,382.04686 C713.141516,440.672126 634.388911,439.139539 484.158007,377.434888 C405.540854,399.703741 366.890462,447.959933 368.174379,522.203462 C368.120638,590.331666 401.093921,639.837612 466.867448,670.671325 C434.809471,639.197634 421.156861,612.743966 425.754563,590.835913 C492.434057,669.802565 568.387234,699.317583 653.4812,679.387085 C615.964887,680.696908 586.248445,668.625202 563.883439,642.99059 C621.400796,641.592694 675.697848,614.89246 726.828497,562.61827 C697.312743,586.105598 666.427352,594.999478 633.726894,589.404987 C722.294422,519.773811 753.634804,438.542918 727.748042,345.712306 Z M567,335 C574.179702,335 580,329.179702 580,322 C580,314.820298 574.179702,309 567,309 C559.820298,309 554,314.820298 554,322 C554,329.179702 559.820298,335 567,335 Z"
              id="Combined-Shape"
              fill="#BA2BD2"
            />
          </g>
        </svg>
      ),
    },
    {
      title: 'NativeScript',
      href: 'https://github.com/NativeScript/NativeScript',
      description:
        'NativeScript empowers you to access native platform APIs from JavaScript directly. Angular, Capacitor, Ionic, React, Svelte, Vue and you name it compatible.',
      icon: (
        <svg
          className="w-10 h-auto text-[#3655FF]"
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M1.77 1.76A5.68 5.68 0 0 1 5.8 0h12.6c1.37 0 2.65.6 3.83 1.76A5.43 5.43 0 0 1 24 5.7v12.77c0 1.34-.56 2.58-1.68 3.73A5.77 5.77 0 0 1 18.25 24H5.87a6.3 6.3 0 0 1-4.1-1.57C.69 21.45.1 20.03 0 18.13V5.73a5.21 5.21 0 0 1 1.77-3.97zm6.25 8.3l7.93 10.06h2.12c.49-.06.88-.2 1.17-.43.3-.23.5-.56.64-1v-4.94c.08-.95.67-1.54 1.77-1.75-1.1-.4-1.69-1.02-1.77-1.86V5.42c-.12-.44-.33-.8-.64-1.07a1.83 1.83 0 0 0-1.09-.47H16v10.2L8.02 3.87H5.79c-.56.1-.97.3-1.25.6S4.08 5.25 4 5.9v4.85c-.35.69-.9 1.1-1.65 1.25.85.16 1.4.61 1.65 1.36v4.77c.02.55.2 1 .54 1.37.33.36.7.53 1.1.5H8l.02-9.94z" />
        </svg>
      ),
    },
    {
      title: 'Typescript eslint',
      href: 'https://github.com/typescript-eslint/typescript-eslint',
      description:
        'Monorepo for all the tooling which enables ESLint to support TypeScript',
      icon: (
        <svg
          className="w-10 h-auto text-[#3178C6]"
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
        </svg>
      ),
    },
    {
      title: 'HomeBridge UI',
      href: 'https://github.com/oznu/homebridge-config-ui-x',
      description:
        'The Homebridge UI. Monitor, configure and backup Homebridge from a browser.',
      icon: (
        <svg
          className="w-10 h-auto text-[#491F59]"
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Homebridge</title>
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm8.116 12.262a.74.74 0 0 1-.741-.74c0-.008.005-.016.005-.025l-1.46-1.46a1.31 1.31 0 0 1-.38-.917V5.731a.285.285 0 0 0-.284-.283h-.915a.284.284 0 0 0-.284.283v2.413L12.17 4.383a.284.284 0 0 0-.4.003L4.438 11.72a.283.283 0 0 0 0 .4l.696.697a.286.286 0 0 0 .4 0l5.635-5.552a1.302 1.302 0 0 1 1.83.008l5.525 5.525a1.3 1.3 0 0 1 0 1.836l-.679.68a1.305 1.305 0 0 1-1.824.012l-3.876-3.766a.283.283 0 0 0-.4.004l-3.723 3.74a.285.285 0 0 0 0 .4l.687.69a.283.283 0 0 0 .4 0l2.013-1.986a1.302 1.302 0 0 1 1.824 0l1.994 1.96.007.007a1.299 1.299 0 0 1 0 1.837l-1.985 1.984v.013a.74.74 0 1 1-.74-.741c.009 0 .016.005.025.005l1.975-1.98a.284.284 0 0 0 .084-.201.28.28 0 0 0-.085-.2l-1.995-1.96a.285.285 0 0 0-.4 0l-2.006 1.98a1.3 1.3 0 0 1-1.83-.004l-.69-.689a1.301 1.301 0 0 1 0-1.834l3.72-3.74a1.303 1.303 0 0 1 1.826-.016l3.879 3.758a.285.285 0 0 0 .4 0l.679-.679a.285.285 0 0 0 0-.4L12.28 7.986a.284.284 0 0 0-.4 0l-5.637 5.555a1.301 1.301 0 0 1-1.829-.008l-.698-.694-.002-.003a1.296 1.296 0 0 1 .002-1.834l7.334-7.334a1.305 1.305 0 0 1 1.821-.015l2.166 2.097v-.019a1.3 1.3 0 0 1 1.299-1.298h.916a1.3 1.3 0 0 1 1.298 1.298v3.384a.282.282 0 0 0 .083.2l1.467 1.467h.014a.74.74 0 0 1 .001 1.48z" />
        </svg>
      ),
    },
    // {
    //   title: 'Responsible AI widget (Microsoft)',
    //   href: 'https://github.com/microsoft/responsible-ai-widgets',
    //   description:
    //     'This project provides responsible AI user interfaces for Fairlearn, interpret-community, and Error Analysis, as well as foundational building blocks that they rely on.',
    //   icon: (
    //     <svg
    //       className="w-10 h-auto text-[#5E5E5E]"
    //       fill="currentColor"
    //       role="img"
    //       viewBox="0 0 24 24"
    //       xmlns="http://www.w3.org/2000/svg"
    //     >
    //       <path d="M0 0v11.408h11.408V0zm12.594 0v11.408H24V0zM0 12.594V24h11.408V12.594zm12.594 0V24H24V12.594z" />
    //     </svg>
    //   ),
    // },
    {
      title: 'NGX Bootstrap',
      href: 'https://github.com/valor-software/ngx-bootstrap',
      description:
        'Fast and reliable Bootstrap widgets in Angular (supports Ivy engine)',
      icon: (
        <svg
          className="w-10 h-auto"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 27"
        >
          <mask
            id="mask0_201:20"
            style={{ maskType: 'alpha' }}
            maskUnits="userSpaceOnUse"
          >
            <path
              d="M11.9595 0L0 4.40496L1.89024 20.8044L11.9595 26.6047L22.1104 20.7263L24 4.32741L11.9595 0Z"
              fill="white"
            />
          </mask>
          <g mask="url(#mask0_201:20)">
            <path
              d="M11.9595 0L0 4.40496L1.89024 20.8044L11.9595 26.6047L22.1104 20.7263L24 4.32741L11.9595 0Z"
              fill="#DD0031"
            />
            <path d="M25.1163 0H11.907V28.093H25.1163V0Z" fill="#C3002F" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9.48837 11.3488H13.4188C13.9968 11.3488 14.4785 11.1803 14.8639 10.8431C15.2492 10.506 15.4419 10.0201 15.4419 9.38543C15.4419 8.67146 15.2685 8.16905 14.9217 7.87817C14.5748 7.5873 14.0739 7.44186 13.4188 7.44186H9.48837V11.3488ZM6.88372 5.39535H13.5471C14.7761 5.39535 15.7618 5.68197 16.5043 6.25523C17.2468 6.82848 17.6181 7.69487 17.6181 8.85441C17.6181 9.55795 17.4484 10.1605 17.1092 10.6621C16.7699 11.1637 16.2867 11.5513 15.6594 11.8249V11.864C16.5043 12.0464 17.1444 12.4535 17.5797 13.0854C18.0149 13.7173 18.2326 14.5088 18.2326 15.4598C18.2326 16.007 18.1365 16.5184 17.9445 16.9939C17.7525 17.4695 17.4516 17.8799 17.042 18.2251C16.6323 18.5704 16.1075 18.844 15.4674 19.0459C14.8273 19.2479 14.0656 19.3488 13.1822 19.3488H6.88372V5.39535ZM9.48837 17.3023H13.7085C14.4342 17.3023 14.9975 17.1136 15.3985 16.7363C15.7995 16.3589 16 15.8248 16 15.134C16 14.456 15.7995 13.9347 15.3985 13.5701C14.9975 13.2055 14.4342 13.0233 13.7085 13.0233H9.48837V17.3023Z"
              fill="white"
            />
          </g>
        </svg>
      ),
    },
    {
      title: 'WooCommerce',
      href: 'https://github.com/woocommerce/woocommerce',
      description:
        'WooCommerce is a customizable, open-source eCommerce platform built on WordPress. Get started quickly and make your way.',
      icon: (
        <svg
          className="w-10 h-auto text-[#96588A]"
          fill="currentColor"
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M2.227 4.857A2.228 2.228 0 000 7.094v7.457c0 1.236 1.001 2.237 2.237 2.237h9.253l4.229 2.355-.962-2.355h7.006c1.236 0 2.237-1 2.237-2.237V7.094c0-1.236-1-2.237-2.237-2.237zm8.08 1.311c.194.002.372.071.535.2a.769.769 0 01.304.56.851.851 0 01-.098.47c-.382.707-.696 1.894-.951 3.542-.246 1.6-.334 2.846-.275 3.739.02.245-.02.46-.118.647a.632.632 0 01-.52.353c-.255.02-.52-.098-.775-.362-.913-.933-1.639-2.326-2.169-4.18a184.085 184.085 0 00-1.413 2.825c-.578 1.11-1.069 1.678-1.481 1.708-.265.02-.49-.206-.687-.677-.5-1.286-1.04-3.768-1.619-7.448-.03-.255.02-.48.157-.657.137-.186.344-.284.618-.304.5-.04.785.196.854.706.304 2.051.638 3.788.991 5.21L5.809 8.41c.196-.373.441-.57.736-.589.431-.03.696.245.804.824.246 1.305.56 2.414.932 3.356.255-2.492.687-4.288 1.295-5.397.148-.274.363-.412.648-.431a.866.866 0 01.084-.004zm3.734 1.063c.167 0 .343.02.53.06.687.146 1.216.52 1.57 1.137.314.53.47 1.168.47 1.933 0 1.011-.254 1.933-.765 2.777-.588.981-1.354 1.472-2.305 1.472-.167 0-.344-.02-.53-.059-.697-.147-1.217-.52-1.57-1.138-.314-.54-.471-1.187-.471-1.943 0-1.01.255-1.933.765-2.767.599-.981 1.364-1.472 2.306-1.472zm6.152 0c.167 0 .343.02.53.06.696.146 1.216.52 1.57 1.137.314.53.47 1.168.47 1.933 0 1.011-.254 1.933-.765 2.777-.588.981-1.354 1.472-2.305 1.472-.167 0-.344-.02-.53-.059-.697-.147-1.217-.52-1.57-1.138-.314-.54-.471-1.187-.471-1.943 0-1.01.255-1.933.765-2.767.599-.981 1.364-1.472 2.306-1.472zm-6.107 1.645c-.307-.002-.606.201-.889.622a3.173 3.173 0 00-.52 1.168c-.05.225-.069.47-.069.716 0 .284.06.589.177.893.147.382.343.589.579.638.245.049.51-.06.795-.315.363-.323.608-.804.745-1.452.05-.225.069-.47.069-.726a2.49 2.49 0 00-.176-.893c-.148-.382-.344-.588-.58-.637a.714.714 0 00-.131-.014zm6.152 0c-.307-.002-.606.201-.889.622a3.173 3.173 0 00-.52 1.168c-.049.225-.069.47-.069.716 0 .284.06.589.177.893.147.382.344.589.579.638.245.049.51-.06.795-.315.363-.323.608-.804.745-1.452.04-.225.07-.47.07-.726a2.49 2.49 0 00-.177-.893c-.148-.382-.344-.588-.58-.637a.714.714 0 00-.131-.014Z" />
        </svg>
      ),
    },
    // {
    //   title: 'Taiga UI',
    //   href: 'https://github.com/TinkoffCreditSystems/taiga-ui',
    //   description:
    //     'Taiga UI is fully-treeshakable Angular UI Kit consisting of multiple base libraries and several add-ons.',
    //   icon: (
    //     <svg
    //       className="w-10 h-auto"
    //       role="img"
    //       viewBox="0 0 34 30"
    //       fill="none"
    //       xmlns="http://www.w3.org/2000/svg"
    //     >
    //       <path
    //         fillRule="evenodd"
    //         clipRule="evenodd"
    //         d="M34 29.4667L17 0L0 29.4667H10.3208L14.6218 22.8197H11.4867L17.0002 14.09L22.5137 22.8197H19.3785L23.6795 29.4667H34Z"
    //         fill="#FF7043"
    //       />
    //     </svg>
    //   ),
    // },
  ];
  const opacityTranslateXVariant = {
    hidden: {
      opacity: 0,
      x: -46,
    },
    visible: (delay: number = 0) => ({
      opacity: 1,
      x: 0,
      transition: { delay, duration: 0.32 },
    }),
  };
  const controls = useAnimation();
  const [ref, inView] = useInView({ threshold: 0.5, triggerOnce: true });

  useEffect(() => {
    if (!inView) return;
    controls.start('visible');
  }, [controls, inView]);

  return (
    <div id="open-source">
      <motion.div
        ref={ref}
        animate={controls}
        initial="hidden"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              when: 'beforeChildren',
              staggerChildren: 0.12,
              ease: 'linear',
              duration: 0.24,
              type: 'tween',
            },
          },
        }}
        className="lg:mx-auto lg:max-w-7xl p-4 flex"
      >
        <div className="w-full rounded-lg bg-gray-200 overflow-hidden shadow divide-y divide-gray-200 divide-y-0 grid grid-cols-2 gap-px">
          {projectList.map((project, index: number) => (
            <motion.div
              key={project.title + '-' + index}
              custom={0.12 * index + 0.24}
              variants={opacityTranslateXVariant}
              className={cx(
                index === 0 ? 'rounded-tl-lg' : '',
                index === 1 ? 'sm:rounded-tr-lg' : '',
                index === projectList.length - 2 ? 'rounded-bl-lg' : '',
                index === projectList.length - 1
                  ? 'rounded-br-lg rounded-bl-none'
                  : '',
                'relative w-full group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-nx-base'
              )}
            >
              <div>
                <span className="rounded-lg inline-flex">{project.icon}</span>
              </div>
              <div className="sm:mt-2">
                <h3 className="text-lg font-medium">
                  <Link href={project.href}>
                    <a
                      target="_blank"
                      rel="nofollow"
                      className="focus:outline-none"
                    >
                      {/* Extend touch target to entire panel */}
                      <span className="absolute inset-0" aria-hidden="true" />
                      {project.title}
                    </a>
                  </Link>
                </h3>
                <p className="mt-2 hidden sm:block text-sm text-gray-400">
                  {project.description}
                </p>
              </div>
              <span
                className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400 transition-all group-hover:translate-x-2 group-hover:-translate-y-2"
                aria-hidden="true"
              >
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                </svg>
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default OpenSourceProjects;
