export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-zinc-500">
            Last updated: June 17, 2026
          </p>
        </div>

        <div className="space-y-10 text-sm text-zinc-400 leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="mb-3">
              By creating an account or accessing DangDoro
              (&quot;the Application&quot;), you agree to be bound by these
              Terms of Service. If you do not agree, do not use the
              Application.
            </p>
            <p>
              We may update these terms at any time. Continued use after
              changes are posted constitutes acceptance of the revised terms.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              2. User Accounts
            </h2>
            <p className="mb-3">
              DangDoro uses Google Sign-In for authentication. You are solely
              responsible for:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>
                Maintaining the confidentiality of your Google account
                credentials.
              </li>
              <li>
                All activity that occurs under your DangDoro account.
              </li>
              <li>
                Notifying us immediately if you suspect unauthorized use of
                your account.
              </li>
            </ul>
            <p>
              We are not liable for any loss or damage arising from your
              failure to safeguard your account.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              3. Acceptable Use
            </h2>
            <p className="mb-3">
              You agree to use DangDoro only for lawful purposes and in a way
              that does not infringe the rights of others. Prohibited conduct
              includes:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>
                Harassing, abusing, or threatening other users.
              </li>
              <li>
                Impersonating another person or entity.
              </li>
              <li>
                Uploading or sharing harmful, offensive, or misleading
                content.
              </li>
              <li>
                Disrupting or interfering with the Application&apos;s social
                features, servers, or networks.
              </li>
              <li>
                Attempting to bypass any security measures or access data
                you are not authorized to view.
              </li>
            </ul>
            <p>
              We reserve the right to remove any content or restrict access
              to users who violate these rules.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              4. Intellectual Property
            </h2>
            <p className="mb-3">
              All rights, title, and interest in DangDoro &mdash; including
              its codebase, design, branding, trademarks, and visual assets
              &mdash; are owned exclusively by the DangDoro team.
            </p>
            <p>
              You may not copy, modify, distribute, sell, or reverse-engineer
              any part of the Application without prior written permission.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              5. Termination
            </h2>
            <p className="mb-3">
              We reserve the right to suspend or terminate your account at
              any time, without prior notice, if you violate these Terms of
              Service or engage in conduct we deem harmful to the platform
              or its users.
            </p>
            <p className="mb-3">Upon termination:</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>Your access to the Application will be revoked.</li>
              <li>
                We may delete your account and associated data in accordance
                with our Privacy Policy.
              </li>
            </ul>
            <p>
              If you wish to voluntarily delete your account, please contact
              us at{" "}
              <a
                href="mailto:bitraa002@gmail.com"
                className="text-[#C9B037] hover:text-[#d4c04a] transition-colors"
              >
                bitraa002@gmail.com
              </a>
              .
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              6. Limitation of Liability &amp; Disclaimers
            </h2>
            <p className="mb-3">
              DangDoro is provided{" "}
              <strong className="text-zinc-300">&quot;as is&quot;</strong>{" "}
              and{" "}
              <strong className="text-zinc-300">
                &quot;as available&quot;
              </strong>{" "}
              without any warranties, express or implied, including but not
              limited to merchantability, fitness for a particular purpose,
              or non-infringement.
            </p>
            <p className="mb-3">
              We do not guarantee that the Application will be uninterrupted,
              error-free, or secure.
            </p>
            <p>
              To the fullest extent permitted by law, DangDoro and its
              operators shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages arising from your
              use of the Application &mdash; including loss of data, focus
              session records, or productivity.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              7. Governing Law
            </h2>
            <p>
              These Terms of Service shall be governed by and construed in
              accordance with the laws of{" "}
              <strong className="text-zinc-300">Spain</strong>, without
              regard to its conflict-of-law provisions. Any disputes arising
              under these terms shall be resolved in the courts of Spain.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              8. Contact Information
            </h2>
            <p className="mb-4">
              For questions, concerns, or requests regarding these Terms of
              Service, please contact us at:
            </p>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-1">
              <p>
                <strong className="text-zinc-300">Email:</strong>{" "}
                 <a
                href="mailto:bitraa002@gmail.com"
                className="text-[#C9B037] hover:text-[#d4c04a] transition-colors"
              >
                bitraa002@gmail.com
              </a>
              </p>
              <p>
                <strong className="text-zinc-300">Application:</strong>{" "}
                DangDoro (dangdoro.com)
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
