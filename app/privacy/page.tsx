export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-zinc-500">
            Last updated: June 17, 2026
          </p>
        </div>

        <div className="space-y-10 text-sm text-zinc-400 leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              1. Information We Collect
            </h2>
            <p className="mb-4">
              When you sign in to DangDoro using Google OAuth, we collect the
              following information from your Google account:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>
                <strong className="text-zinc-300">Email address</strong>
              </li>
              <li>
                <strong className="text-zinc-300">Display name</strong>
              </li>
              <li>
                <strong className="text-zinc-300">Profile picture (avatar URL)</strong>
              </li>
            </ul>
            <p className="mb-4">
              We do <strong className="text-zinc-300">not</strong> collect your
              Google password or any other sensitive account credentials.
              Authentication is handled entirely by Google&apos;s OAuth 2.0
              service.
            </p>
            <h3 className="text-base font-medium text-white mb-3">
              Automatically Collected Data
            </h3>
            <p className="mb-3">
              We may also collect standard server logs and analytics data, such
              as:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>IP address</li>
              <li>Browser type and version</li>
              <li>Pages visited and session duration</li>
              <li>Referring URL</li>
            </ul>
            <p className="mt-3">
              This information is used solely to improve the performance and
              reliability of the application.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              2. How We Use Your Information
            </h2>
            <p className="mb-4">
              We use the information we collect for the following purposes:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>
                <strong className="text-zinc-300">Account creation and management</strong>
                {" "}&ndash; to set up and maintain your DangDoro profile.
              </li>
              <li>
                <strong className="text-zinc-300">Profile personalization</strong>
                {" "}&ndash; to display your name and avatar on your profile and
                in social features.
              </li>
              <li>
                <strong className="text-zinc-300">Social focus features</strong>
                {" "}&ndash; to enable friend connections, leaderboards, focus
                streaks, and shared session activity.
              </li>
              <li>
                <strong className="text-zinc-300">Service improvement</strong>
                {" "}&ndash; to analyze usage patterns and fix bugs or
                performance issues.
              </li>
              <li>
                <strong className="text-zinc-300">Communication</strong>
                {" "}&ndash; to send service-related emails (e.g., account
                verification, password reset) if applicable.
              </li>
            </ul>
            <p>
              We will <strong className="text-zinc-300">never</strong> use your
              personal data for advertising, profiling, or automated
              decision-making.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              3. Data Sharing and Disclosure
            </h2>
            <p className="mb-4">
              We do <strong className="text-zinc-300">not</strong> sell, rent,
              or trade your personal information to third parties.
            </p>
            <p className="mb-4">
              We may share your information only in the following limited
              circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>
                <strong className="text-zinc-300">Service providers</strong>
                {" "}&ndash; with trusted third-party services that help us
                operate the application (e.g., hosting, database, error logging).
                These providers are contractually bound to protect your data and
                may only use it for the purposes we specify.
              </li>
              <li>
                <strong className="text-zinc-300">Legal compliance</strong>
                {" "}&ndash; if required by law, regulation, or valid legal
                process (e.g., a court order or subpoena).
              </li>
              <li>
                <strong className="text-zinc-300">Protection of rights</strong>
                {" "}&ndash; to enforce our Terms of Service or protect the
                safety, rights, or property of DangDoro, its users, or the
                public.
              </li>
            </ul>
            <h3 className="text-base font-medium text-white mb-3">
              Public Profile Information
            </h3>
            <p>
              Your display name and profile picture may be visible to other
              users as part of DangDoro&apos;s social features (e.g., friend
              lists, leaderboards). Your email address is{" "}
              <strong className="text-zinc-300">never</strong> shared publicly.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              4. Data Retention and Deletion
            </h2>
            <p className="mb-4">
              We retain your personal information for as long as your account
              is active and as needed to provide the service.
            </p>
            <h3 className="text-base font-medium text-white mb-3">
              Account Deletion
            </h3>
            <p className="mb-3">
              You may request deletion of your account and associated data at
              any time by contacting us at{" "}
              <a
                href="mailto:bitraa002@gmail.com"
                className="text-[#C9B037] hover:text-[#d4c04a] transition-colors"
              >
                bitraa002@gmail.com
              </a>
              . Upon verification of your identity, we will:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>
                Permanently delete your personal information from our systems.
              </li>
              <li>
                Remove your profile and associated data (focus sessions,
                streaks, friend connections) from the application.
              </li>
            </ul>
            <p className="mb-4">
              We will process deletion requests within{" "}
              <strong className="text-zinc-300">30 days</strong> of receipt.
            </p>
            <h3 className="text-base font-medium text-white mb-3">
              Data Backup
            </h3>
            <p>
              Residual copies of your data may remain in our backups for a
              short period after deletion, but will be purged in accordance
              with our backup retention schedule (typically 90 days or less).
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              5. Data Security
            </h2>
            <p className="mb-4">
              We implement industry-standard security measures to protect your
              personal information, including:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>Encryption in transit (TLS/HTTPS)</li>
              <li>Encryption at rest</li>
              <li>Access controls and authentication safeguards</li>
              <li>Regular security reviews</li>
            </ul>
            <p>
              However, no method of electronic storage or transmission is 100%
              secure. We cannot guarantee absolute security.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              6. Your Rights Under GDPR
            </h2>
            <p className="mb-4">
              If you are a resident of the European Economic Area (EEA), you
              have the following rights:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>
                <strong className="text-zinc-300">Right to access</strong>
                {" "}&ndash; request a copy of the personal data we hold about
                you.
              </li>
              <li>
                <strong className="text-zinc-300">Right to rectification</strong>
                {" "}&ndash; request correction of inaccurate or incomplete
                data.
              </li>
              <li>
                <strong className="text-zinc-300">
                  Right to erasure (&quot;right to be forgotten&quot;)
                </strong>
                {" "}&ndash; request deletion of your personal data.
              </li>
              <li>
                <strong className="text-zinc-300">
                  Right to restrict processing
                </strong>
                {" "}&ndash; request that we limit how we use your data.
              </li>
              <li>
                <strong className="text-zinc-300">
                  Right to data portability
                </strong>
                {" "}&ndash; request a machine-readable copy of your data.
              </li>
              <li>
                <strong className="text-zinc-300">Right to object</strong>
                {" "}&ndash; object to our processing of your personal data.
              </li>
            </ul>
            <p>
              To exercise any of these rights, please contact us at{" "}
              <a
                href="mailto:bitraa002@gmail.com"
                className="text-[#C9B037] hover:text-[#d4c04a] transition-colors"
              >
                bitraa002@gmail.com
              </a>
              . We will respond within{" "}
              <strong className="text-zinc-300">30 days</strong>.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              7. Third-Party Links
            </h2>
            <p>
              DangDoro may contain links to external websites (e.g., user-shared
              content). We are not responsible for the privacy practices of
              those third-party sites. We encourage you to review their privacy
              policies before providing them with your personal information.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              8. Children&apos;s Privacy
            </h2>
            <p>
              DangDoro is not directed at individuals under the age of{" "}
              <strong className="text-zinc-300">13</strong> (or{" "}
              <strong className="text-zinc-300">16</strong> in the EEA). We do
              not knowingly collect personal information from children. If we
              become aware that a child has provided us with personal data, we
              will take steps to delete it promptly.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              9. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Material
              changes will be communicated via email or through a notice on the
              DangDoro application. Your continued use of the service after
              changes take effect constitutes your acceptance of the updated
              policy.
            </p>
          </section>

          <hr className="border-white/5" />

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">
              10. Contact Information
            </h2>
            <p className="mb-4">
              If you have any questions, concerns, or requests regarding this
              Privacy Policy or your personal data, please contact us at:
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
