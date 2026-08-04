import LegalLayout from "@/components/LegalLayout";

/** Support / privacy contact. Change this to your own address. */
export const CONTACT_EMAIL = "gglvlup.fit@gmail.com";

const Privacy = () => (
  <LegalLayout title="Privacy Policy" updated="July 2026">
    <p>
      GGLvlup ("we", "us") is a gamified health and fitness tracker. This policy explains what we collect, why, and the
      control you have over your data. By using GGLvlup you agree to this policy.
    </p>

    <h2>Information we collect</h2>
    <ul>
      <li>
        <strong>Account details.</strong> When you sign in with Google we receive your name, email address and profile
        picture. We use these to create and secure your account.
      </li>
      <li>
        <strong>Health &amp; fitness data you enter.</strong> Your weight, calories, protein, water, steps, exercise,
        goals and target weight. You choose what to log; this data is yours.
      </li>
      <li>
        <strong>Usage &amp; device data.</strong> Basic analytics about how you use the app (pages viewed, features used)
        to improve the product, plus standard technical data your browser sends.
      </li>
    </ul>

    <h2>How we use your data</h2>
    <ul>
      <li>To run the app: show your dashboard, streaks, trophies, levels and challenges.</li>
      <li>To provide optional reminders you turn on (push notifications).</li>
      <li>To understand which features help people and improve the app.</li>
      <li>To process Premium purchases, if you buy one.</li>
    </ul>
    <p>
      <strong>We do not sell your personal data.</strong> Your health data is used to power the features you see — it is
      never sold or shared for advertising.
    </p>

    <h2>Service providers we share with</h2>
    <ul>
      <li>
        <strong>Supabase</strong> — hosts our database and authentication (stores your account and logs).
      </li>
      <li>
        <strong>Google</strong> — sign-in provider.
      </li>
      <li>
        <strong>PostHog</strong> — privacy-friendly product analytics.
      </li>
      <li>
        <strong>Whop</strong> — processes Premium payments (we never see your card details).
      </li>
    </ul>
    <p>Each processes data only to provide their service to us, under their own privacy terms.</p>

    <h2>Your rights &amp; choices</h2>
    <ul>
      <li>
        <strong>Export.</strong> Download your full history any time as CSV or PDF from the app's Analytics section.
      </li>
      <li>
        <strong>Delete.</strong> Delete your account from <em>Update Profile → Delete account</em>. This permanently
        removes your profile, logs, trophies, challenges and reminder subscriptions.
      </li>
      <li>
        <strong>Reminders.</strong> Notifications are opt-in and can be turned off in your browser or device settings.
      </li>
    </ul>

    <h2>Data retention</h2>
    <p>
      We keep your data while your account is active. When you delete your account, your personal data is removed
      promptly; limited payment records may be retained where required for accounting/legal reasons.
    </p>

    <h2>Not medical advice</h2>
    <p>
      GGLvlup is for general wellness and motivation only. It is not a medical device and does not provide medical
      advice. Consult a qualified professional before making health decisions.
    </p>

    <h2>Children</h2>
    <p>GGLvlup is not directed to children under 13, and we do not knowingly collect their data.</p>

    <h2>Changes</h2>
    <p>We may update this policy; we'll revise the "Last updated" date above when we do.</p>

    <h2>Contact</h2>
    <p>
      Questions or requests? Email us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
    </p>
  </LegalLayout>
);

export default Privacy;
