import LegalLayout from "@/components/LegalLayout";

/** Support / privacy contact. Change this to your own address. */
export const CONTACT_EMAIL = "gglvlup.fit@gmail.com";

// ---------------------------------------------------------------------------
// ⚠️  PLACEHOLDERS — replace before launch, and have a lawyer review the page.
//     Search this file for "[[" to find every one.
//
//     This text describes accurately what the code actually does. It is not
//     legal advice and has not been reviewed by anyone qualified.
// ---------------------------------------------------------------------------
const ENTITY = "[[YOUR LEGAL ENTITY NAME]]";
const ADDRESS = "[[YOUR REGISTERED BUSINESS ADDRESS]]";

const Privacy = () => (
  <LegalLayout title="Privacy Policy" updated="August 2026">
    <p>
      GGLvlup is a gamified health and fitness tracker operated by {ENTITY}, {ADDRESS} ("we", "us").
      We are the data controller for the personal data described below. This policy explains what we
      collect, why, the legal basis for it, and the control you have.
    </p>

    <h2>Information we collect</h2>
    <ul>
      <li>
        <strong>Account details.</strong> When you sign in with Google we receive your name, email
        address and profile picture. We use these to create and secure your account.
      </li>
      <li>
        <strong>Health &amp; fitness data you enter.</strong> Your weight, calories, protein, water,
        steps, exercise, age, height, gender, goals and target weight. This is sensitive ("special
        category") data, and we process it only with your explicit consent — the tick box during
        setup.
      </li>
      <li>
        <strong>Usage &amp; device data.</strong> If — and only if — you allow analytics cookies, we
        collect basic product analytics (pages viewed, features used) plus the standard technical
        data your browser sends. Decline and none of it is collected; the app works identically.
      </li>
      <li>
        <strong>Payment records.</strong> If you buy Premium we store the payment reference, amount,
        currency and status returned by our payment provider. We never receive or store card details.
      </li>
    </ul>

    <h2>Why we use it, and our legal basis</h2>
    <ul>
      <li>
        <strong>To run the app</strong> — dashboard, streaks, trophies, levels, challenges.{" "}
        <em>Basis: performance of our contract with you; explicit consent for health data.</em>
      </li>
      <li>
        <strong>To send reminders you switch on.</strong> <em>Basis: consent.</em>
      </li>
      <li>
        <strong>To understand which features help people.</strong>{" "}
        <em>Basis: consent (analytics cookies).</em>
      </li>
      <li>
        <strong>To process purchases and keep accounting records.</strong>{" "}
        <em>Basis: contract, and our legal obligation to retain financial records.</em>
      </li>
      <li>
        <strong>To keep the service secure and prevent cheating.</strong>{" "}
        <em>Basis: our legitimate interest in a working, fair service.</em>
      </li>
    </ul>
    <p>
      <strong>We do not sell your personal data</strong>, and we never share your health data for
      advertising.
    </p>

    <h2>What other users can see</h2>
    <p>
      GGLvlup is social by design, so some of your data is visible to people you choose to compete
      with. If you join or accept a <strong>challenge</strong>, every other member of that challenge
      can see your nickname, your quest XP, your average daily steps, your number of exercise days
      and your <strong>percentage weight change</strong> over the challenge window.
    </p>
    <p>
      They cannot see your actual weight, your food or water logs, your email address, or any other
      profile detail. If you would rather share none of it, don't join a challenge — every other
      feature works without one.
    </p>

    <h2>Service providers we share with</h2>
    <ul>
      <li>
        <strong>Supabase</strong> — database and authentication hosting (your account and logs).
      </li>
      <li>
        <strong>Google</strong> — sign-in provider.
      </li>
      <li>
        <strong>PostHog</strong> — product analytics. Receives nothing unless you allow analytics
        cookies.
      </li>
      <li>
        <strong>Whop</strong> — processes Premium payments.
      </li>
    </ul>
    <p>
      Each processes data only to provide their service to us, under their own terms. These providers
      may store or process data outside your country, including in the United States; where required
      we rely on Standard Contractual Clauses or an equivalent safeguard.{" "}
      [[CONFIRM the transfer mechanism with your lawyer and name it here.]]
    </p>

    <h2>How long we keep it</h2>
    <ul>
      <li>
        <strong>Account and health data</strong> — while your account exists. Deleting your account
        removes it immediately and irreversibly.
      </li>
      <li>
        <strong>Payment records</strong> — [[RETENTION PERIOD, e.g. 5 or 10 years]] after the
        transaction, because tax and accounting law requires it. These survive account deletion but
        are unlinked from your profile.
      </li>
      <li>
        <strong>Analytics</strong> — [[YOUR POSTHOG RETENTION SETTING]].
      </li>
      <li>
        <strong>Waitlist emails</strong> — until you ask us to remove you.
      </li>
    </ul>

    <h2>Cookies</h2>
    <p>
      We use a small number of strictly necessary cookies and local storage to keep you signed in and
      to remember settings such as your theme and whether sound is on. These are required for the app
      to work and cannot be switched off.
    </p>
    <p>
      Analytics cookies are <strong>optional and off until you allow them</strong>. You are asked once
      on your first visit and can decline with no loss of functionality. To change your mind later,
      clear this site's data in your browser and you'll be asked again.
    </p>

    <h2>Your rights</h2>
    <ul>
      <li>
        <strong>Access &amp; portability.</strong> Download every day you've logged as a CSV from{" "}
        <em>Analytics &amp; Export → Download my data</em>. Free on every plan.
      </li>
      <li>
        <strong>Deletion.</strong> Delete your account from <em>Settings → Update Profile → Delete
        account</em>. This permanently removes your profile, logs, trophies, challenges and reminder
        subscriptions.
      </li>
      <li>
        <strong>Correction.</strong> Edit any logged value in the app at any time.
      </li>
      <li>
        <strong>Withdraw consent.</strong> Decline or clear analytics cookies whenever you like;
        withdraw health-data consent by deleting your account.
      </li>
      <li>
        <strong>Object or restrict.</strong> Email us and we'll act on it.
      </li>
      <li>
        <strong>Complain.</strong> You can complain to your data protection authority — in the
        Philippines the National Privacy Commission, in the EU/UK your national supervisory authority.
        We'd appreciate the chance to put things right first.
      </li>
    </ul>

    <h2>Security</h2>
    <p>
      Data is encrypted in transit and at rest by our hosting provider, database access is restricted
      by row-level security so an account can only reach its own records, and administrative access is
      limited to accounts that need it. No service can promise perfect security, but if a breach
      affects your data we will notify you and the relevant authority as the law requires.
    </p>

    <h2>Not medical advice</h2>
    <p>
      GGLvlup is for general wellness and motivation only. It is not a medical device, and the
      calorie, protein and weight targets it calculates are general estimates — not a prescription or
      a treatment plan. Consult a qualified professional before making health decisions. If you are
      pregnant, have a medical condition, or have any history of disordered eating, please speak to a
      doctor before using an app like this one.
    </p>

    <h2>Children</h2>
    <p>
      GGLvlup is not for anyone under 13. We ask your age during setup and do not create accounts
      below that age. We do not knowingly collect data from children; if you believe a child has given
      us data, email us and we'll delete it.
    </p>

    <h2>Changes</h2>
    <p>We may update this policy; we'll revise the "Last updated" date above when we do.</p>

    <h2>Contact</h2>
    <p>
      Questions or requests? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.{" "}
      [[If you have EU/UK users and are established outside those regions, you may need to appoint a
      representative under GDPR Art. 27 / UK GDPR and name them here.]]
    </p>
  </LegalLayout>
);

export default Privacy;
