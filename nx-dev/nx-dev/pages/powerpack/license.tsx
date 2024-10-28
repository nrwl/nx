import { useRouter } from 'next/router';
import { NextSeo } from 'next-seo';
import { Footer, Header } from '@nx/nx-dev/ui-common';

export function Contact(): JSX.Element {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Contact us"
        description="There are many ways you can connect with the open-source Nx community. Let's connect together!"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Contact us',
          description:
            "There are many ways you can connect with the open-source Nx community. Let's connect together!",
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart Monorepos · Fast CI',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <Header />
      <main id="main" role="main" className="py-24 lg:py-32">
        <div className="mx-auto max-w-prose">
          <h1 className="text-2xl font-bold leading-7 sm:text-3xl sm:tracking-tight">
            NX POWERPACK END USER LICENSE AGREEMENT
          </h1>
          <h2 className="mt-6 text-lg font-medium leading-6">
            Last Updated: September 18th, 2024
          </h2>
          <p className="mt-12">
            This Nx End User License Agreement (together with your associated
            Order Information, the “Agreement”) governs your use of our Nx
            Powerpack, a suite of paid extensions for Nx (the “Software”). To
            make this Agreement easier to read, the terms “Nx,” “we,” and “us”
            refers to Narwhal Technologies, Inc., and the term “you” refers to
            you and any organization that you are acting on behalf of in signing
            up for a subscription to the Software. If you are an individual
            acting on behalf of an entity, you represent and warrant that you
            have the authority to enter into this Agreement on behalf of that
            entity and to legally bind that entity. If you do not accept the
            terms of this Agreement, then you must not use the Software.
          </p>
          <div className="prose mt-6 mt-8 text-slate-700 dark:text-slate-400">
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              1. DEFINITIONS.
            </h2>
            <dl>
              <dd>
                (a) “Licensed Volume” means the limits, volume or other
                conditions of permitted use for the Software as set forth in the
                Order Information, including any limits on the number of
                Authorized Users or number of workspaces.
              </dd>
              <dd>
                (b) “Nx IP” means the Software, algorithms, technology,
                databases, tools, know-how or processes used to provide or
                deliver the Software or any related services, and its
                documentation (“Documentation”), all improvements, modifications
                or derivative works of the foregoing (regardless of authorship),
                and all intellectual property rights (“IPR”) in any of the
                foregoing.
              </dd>
              <dd>
                (c) “Order Information” means (i) certain terms associated with
                your subscription to Use the Software, as communicated to you
                via our pricing page available at
                https://cloud.nx.app/powerpack/purchase (“Pricing Page”) , as
                may be updated from time to time or (ii) as otherwise set forth
                in a written order form or purchase order signed by you and Nx
                (“PO”).
              </dd>
            </dl>
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              2. LICENSE.
            </h2>
            <dl>
              <dd>
                (a) License. Subject to the terms and conditions of this
                Agreement (including receipt of the License Key), Nx hereby
                grants you a worldwide, non-exclusive, non-transferable (except
                in compliance with Section 12), non-sublicensable license to
                download and install the Software on premises owned or
                controlled by you, and run the Software solely for your internal
                business purposes (the “Purpose”) during the Term in accordance
                with the Documentation and subject to the Licensed Volume. You
                have the right to permit your employees or contributors
                (“Authorized Users”) to use the Software on your behalf for the
                Purpose in accordance with this Agreement; provided, however,
                that you will remain fully and directly liable to Nx for any and
                all use of the Software by Authorized Users as if such use was
                by you yourself under this Agreement. Nothing in this Agreement
                will operate to grant you any right, title or interest, whether
                by implication, estoppel or otherwise, in or to the Nx IP, other
                than as expressly set forth herein. As between Nx and you, Nx
                will exclusively own all right, title and interest in and to the
                Nx IP.
              </dd>
              <dd>
                (b) Use Restrictions. You will not at any time, directly or
                indirectly, and will not permit any person or entity
                (collectively, “Person”) (including, without limitation, your
                Authorized Users) to: (i) copy, modify or create derivative
                works of the Software or Documentation, in whole or in part;
                (ii) reverse engineer, disassemble, decompile, decode or
                otherwise attempt to derive or gain improper access to any
                software component of the Software, in whole or in part; (iii)
                frame, mirror, sell, resell, rent or lease the use of the
                Software, License Key or Documentation to any other Person, or
                otherwise use or allow any Person to use the Software, License
                Key or Documentation for any purpose other than for your benefit
                for the Purpose in accordance with this Agreement; (iv) create
                any script or other automated tool that attempts to create
                multiple License Keys; (v) use the Software or License Key in
                any infringing or unlawful manner; or (vi) use the Software,
                Documentation or any other Confidential Information of Nx for
                competitive analysis or benchmarking purposes, or to otherwise
                develop, commercialize, license or sell any product, service or
                technology that could, directly or indirectly, compete with the
                Nx IP.
              </dd>
              <dd>
                (c) Authorized Equipment. You will bear the sole responsibility
                for obtaining and maintaining the hardware and any computer
                systems, networks, telecommunications systems, Internet access,
                third party services or any other materials required to meet the
                minimum technical and operational requirements required to
                operate the Software.
              </dd>
            </dl>
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              3. LICENSE KEY; FEES AND PAYMENT.
            </h2>
            To use the Software, you are required to purchase a license key via
            the Pricing Page or PO (“License Key”). You are liable for any
            actions or inactions performed under your License Key. You will pay
            Nx all fees set forth in your Order Information (“Fees”) on the
            payment dates specified in your Order Information. All Fees are
            non-refundable. Nx reserves the right to change the Fees and
            Licensed Volume and to institute new Fees and revised limits of the
            Licensed Volume upon 30 days’ prior notice to you. Unless otherwise
            specified in the Order Information, Fees will be paid by the
            approved credit card that you designate when you sign up to use the
            Software. You hereby authorize us to initiate all payment
            transactions for Fees from your approved credit card when such Fees
            are due, if applicable. Any and all Fees that are not paid to Nx
            when due will accrue interest at a rate of 1.5% per month, or the
            maximum rate permitted by law, whichever is greater. In the event of
            a conflict between this Agreement and the Order Information, the
            Order Information will control and govern. All Fees do not include
            any sales, use, value added or other applicable taxes, payment of
            which will be your sole responsibility (excluding any taxes based on
            Nx’s net income).
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              4. CONFIDENTIAL INFORMATION.
            </h2>
            “Confidential Information” means any information that one party (the
            “Disclosing Party”) provides to the other party (the “Receiving
            Party”) in connection with this Agreement, whether orally or in
            writing, that is designated as confidential or that reasonably
            should be considered to be confidential given the nature of the
            information and/or the circumstances of disclosure. Confidential
            Information will not include any information that: (i) is or becomes
            generally known to the public through no fault or breach of this
            Agreement by the Receiving Party; (ii) is rightfully known by the
            Receiving Party at the time of disclosure without an obligation of
            confidentiality; (iii) is independently developed by the Receiving
            Party without access to or use of any Confidential Information of
            the Disclosing Party that can be evidenced in writing; or (iv) is
            rightfully obtained by the Receiving Party from a third-party
            without restriction on use or disclosure. For clarity, the Software
            and the Documentation will be deemed Confidential Information of Nx.
            The Receiving Party will not use or disclose any Confidential
            Information of the Disclosing Party except as necessary to perform
            its obligations or exercise its rights under this Agreement. The
            Receiving Party may disclose Confidential Information of the
            Disclosing Party only: (A) to those of its employees, contractors,
            agents and advisors who have a bona fide need to know such
            Confidential Information to perform under this Agreement and who are
            bound by written agreements with use and nondisclosure restrictions
            at least as protective of the Confidential Information as those set
            forth in this Agreement, or (B) as such disclosure may be required
            by the order or requirement of a court, administrative agency or
            other governmental body, subject to the Receiving Party providing to
            the Disclosing Party reasonable written notice to allow the
            Disclosing Party to seek a protective order or otherwise contest the
            disclosure.
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              5. POLICIES; SUPPORT.
            </h2>
            You hereby acknowledge that you have reviewed and agreed to the Nx
            Privacy Policy at https://cloud.nx.app/privacy. Such policy is
            hereby incorporated into and is hereby deemed a part of this
            Agreement, binding upon you and you Authorized Users with respect to
            your and their use of the Software in connection with this
            Agreement. As part of your subscription to the Software, Nx will
            provide reasonable support in connection with the Software in
            accordance with the support terms set forth in your Order
            Information.
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              6. FEEDBACK.
            </h2>
            From time-to-time you or your Authorized Users may provide Nx with
            feedback with regard to the Software. You, on behalf of yourself and
            your Authorized Users, hereby grant Nx a perpetual, irrevocable,
            royalty-free and fully-paid up license to use and exploit all such
            feedback in connection with Nx’s business purposes.
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              7. INDEMNIFICATION.
            </h2>
            <dl>
              <dd>
                (a) Nx Indemnification. Nx will defend and pay all damages
                finally awarded against you pursuant to a final, valid and
                binding judgment or order, or a final settlement agreement with
                respect to any claim, suit or proceeding brought by a third
                party against you arising from the Software’s infringement of
                such third-party’s IPR. The foregoing obligation will not apply
                if the underlying third-party claim arises from (i) your breach
                of this Agreement, negligence, willful misconduct or fraud; (ii)
                modifications to the Software by anyone other than Nx; or (iii)
                combinations of the Software of with software, data or materials
                not provided by Nx. If Nx reasonably believes the Software (or
                any component) could infringe any third party’s IPR, Nx may, at
                its sole option and expense: (A) procure the right for you to
                continue using the Software (or any infringing component) to
                make it non-infringing without materially reducing its
                functionality; or (B) replace the Software (or any infringing
                component) with a non-infringing alternative that is
                functionally equivalent in all material respects. If the
                foregoing remedies are not available to Nx on commercially
                reasonable terms, then Nx may terminate your use of the Software
                upon notice to you.
              </dd>
              <dd>
                (b) Your Indemnification. You will defend and pay all damages
                finally awarded against Nx pursuant to a final, valid and
                binding judgment or order or a final settlement agreement with
                respect to any claim, suit or proceeding brought by a third
                party against Nx arising from any breach of the restrictions set
                forth in Section 2(b).
              </dd>
              <dd>
                (c) Indemnification Procedures. The party seeking defense and
                indemnity (the “Indemnified Party”) will promptly notify the
                other party (the “Indemnifying Party”) of any and all such
                claims and will reasonably cooperate with the Indemnifying Party
                with the defense and/or settlement thereof. The Indemnifying
                Party will have the sole right to conduct the defense of any
                claim for which the Indemnifying Party is responsible hereunder
                (provided that the Indemnifying Party may not settle any claim
                without the Indemnified Party’s prior written approval unless
                the settlement unconditionally releases the Indemnified Party
                from all liability, does not require any admission by the
                Indemnified Party, and does not place restrictions upon the
                Indemnified Party’s business). The Indemnified Party may
                participate in the defense or settlement of any such claim at
                its own expense and with its own choice of counsel or, if the
                Indemnifying Party refuses to fulfill its obligation of defense,
                the Indemnified Party may defend itself and seek reimbursement
                from the Indemnifying Party.
              </dd>
            </dl>
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              8. DISCLAIMERS.
            </h2>
            THE SOFTWARE IS PROVIDED ON AN “AS IS” BASIS, AND NX MAKES NO
            WARRANTIES OR REPRESENTATIONS TO YOU, YOUR AUTHORIZED USERS OR TO
            ANY OTHER PERSON REGARDING THE SOFTWARE. TO THE MAXIMUM EXTENT
            PERMITTED BY APPLICABLE LAW, NX HEREBY DISCLAIMS (a) ALL WARRANTIES
            AND REPRESENTATIONS, WHETHER EXPRESS OR IMPLIED AND (b) ANY WARRANTY
            THAT USE OF THE SOFTWARE WILL BE ERROR-FREE.
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              9. LIMITATIONS OF LIABILITY.
            </h2>
            EXCEPT FOR A PARTY’S GROSS NEGLIGENCE, WILLFUL MISCONDUCT OR FRAUD,
            IN NO EVENT WILL (a) EITHER PARTY BE LIABLE TO THE OTHER PARTY FOR
            ANY INCIDENTAL, SPECIAL, EXEMPLARY, PUNITIVE OR CONSEQUENTIAL
            DAMAGES, LOSS OF INCOME, DATA, PROFITS, REVENUE OR BUSINESS
            INTERRUPTION, OR THE COST OF SUBSTITUTE SERVICES OR OTHER ECONOMIC
            LOSS, ARISING OUT OF OR IN CONNECTION WITH THIS AGREEMENT, WHETHER
            SUCH LIABILITY ARISES FROM ANY CLAIM BASED ON CONTRACT, WARRANTY,
            TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY OR OTHERWISE, AND
            WHETHER OR NOT SUCH PARTY HAS BEEN ADVISED OF THE POSSIBILITY OF
            SUCH LOSS OR DAMAGE AND (b) NX’S TOTAL LIABILITY TO YOU, YOUR
            AUTHORIZED USERS OR ANY OTHER PERSON IN CONNECTION WITH THIS
            AGREEMENT OR THE PROVISION OF THE SOFTWARE EXCEED THE FEES ACTUALLY
            PAID BY YOU TO NX IN THE 12 MONTH PERIOD PRECEDING THE ACTION GIVING
            RISE TO SUCH LIABILITY.
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              10. TERM AND TERMINATION.
            </h2>
            <dl>
              <dd>
                (a) Term; Termination. The term of this Agreement will begin on
                the effective date in the Order Information, and will expire at
                the end of the initial term specified in the Order Information
                (the “Initial Term”). Following the Initial Term, this Agreement
                will automatically renew for successive one-month terms (the
                Initial Term, together with any renewal term, the “Term”),
                unless Nx or you provides the other with at least twenty (20)
                days’ written notice of its intent not to renew prior to the end
                of the then-current term. Either party may terminate this
                Agreement, effective on written notice to the other party, if
                the other party materially breaches this Agreement, and such
                breach: (A) is incapable of cure; or (B) being capable of cure,
                remains uncured thirty (30) days after the non-breaching party
                provides the breaching party with written notice of such breach.
              </dd>
              <dd>
                (b) Effect of Termination; Survival. Upon termination of this
                Agreement, your right to use the Software will immediately
                terminate and you shall cease using the Software, including for
                example, by permanently removing the Software dependency. This
                Section 10(b) and Sections 2(b), 3, 4, 5 (first sentence), 6 – 9
                and 12 survive any termination of this Agreement.
              </dd>
            </dl>
            <h2 className="mt-6 text-slate-700 dark:text-slate-400">
              11. TRADEMARKS.
            </h2>
            You hereby grant Nx a limited, non-exclusive, royalty-free license
            to use and display your name, designated trademarks and associated
            logos (“Your Marks”) during the Term in connection with Nx’s
            marketing and promotional efforts for its products and services,
            including by publicly naming you as a customer of Nx. Nx will
            conform to and observe the trademark standards as you prescribe from
            time to time. All goodwill generated by Nx’s use of Your Marks
            inures to your benefit.
            <h2 className="my-6 text-slate-700 dark:text-slate-400">
              12. MISCELLANEOUS.
            </h2>
            This Agreement, together with the Order Information, is the complete
            and exclusive agreement between the parties with respect to its
            subject matter and supersedes all prior or contemporaneous
            agreements, communications and understandings, both written and
            oral, with respect to its subject matter, including any prior terms.
            This Agreement may be amended or modified only by a written document
            assented by duly authorized representatives of the parties. Nx may
            perform an audit of your use of the Software once per year in
            connection with your compliance with this Agreement, including if
            you are exceeding the Licensed Volume. Nx may provide notices to you
            by posting them on our website, by providing electronic notification
            via the Software, or by email to the address associated with your
            account. You may provide notices to us via email at
            powerpack-support@nrwl.io. All notices are effective upon posting or
            when delivered. Except as otherwise set forth herein, either party’s
            failure to enforce any provision of this Agreement will not
            constitute a waiver of future enforcement of that or any other
            provision. No waiver of any provision of this Agreement will be
            effective unless it is in writing and signed by the party granting
            the waiver. If any provision of this Agreement is held invalid,
            illegal or unenforceable, that provision will be enforced to the
            maximum extent permitted by law, and the remaining provisions of
            this Agreement will remain in full force and effect. This Agreement
            will be governed by and construed in accordance with the laws of the
            State of California without giving effect to any principles of
            conflict of laws that would lead to the application of the laws of
            another jurisdiction. Any legal action or proceeding arising under
            this Agreement will be brought exclusively in the federal or state
            courts located in the Northern District of California and the
            parties irrevocably consent to the personal jurisdiction and venue
            therein. Nx may freely assign its rights and obligations under this
            Agreement. You may not assign or transfer this Agreement, by
            operation of law or otherwise, without Nx’s prior written consent;
            provided, however, that you may assign your rights or delegate your
            obligations, in whole or in part, without such consent, to (i) one
            or more of your affiliates, or (ii) a third party that succeeds to
            all or substantially all of your business and assets relating to the
            subject matter of this Agreement, whether by sale, merger, operation
            of law or otherwise. Any attempt to assign or transfer this
            Agreement without such consent will be void. Subject to the
            foregoing, this Agreement is binding upon and will inure to the
            benefit of each of the parties and their respective successors and
            permitted assigns. Unless otherwise expressly provided, no
            provisions of this Agreement are intended or will be construed to
            confer upon or give to any person or entity, other than the parties,
            any rights, remedies or other benefits under or by reason of this
            Agreement.
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default Contact;
