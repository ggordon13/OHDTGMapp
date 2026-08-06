import LegalLayout from "@/components/LegalLayout";
import { CONTACT_EMAIL } from "@/pages/Privacy";

const Terms = () => (
  <LegalLayout title="Terms of Service" updated="July 2026">
    <p>
      Welcome to GGLvlup. By creating an account or using the app you agree to these terms. If you don't agree, please
      don't use the app.
    </p>

    <h2>Your account</h2>
    <ul>
      <li>You must be at least 13 years old to use GGLvlup.</li>
      <li>You're responsible for the activity on your account and for keeping your sign-in secure.</li>
      <li>Provide accurate information; the app's guidance is only as good as the data you enter.</li>
    </ul>

    <h2>Acceptable use</h2>
    <ul>
      <li>Don't misuse the app, attempt to break its security, or disrupt other users.</li>
      <li>
        Don't falsify data to game challenges or leaderboards. We may adjust or remove results, or suspend accounts, to
        keep things fair.
      </li>
      <li>Challenges are social features — treat other participants with respect.</li>
    </ul>

    <h2>Age</h2>
    <p>
      You must be at least <strong>13 years old</strong> to use GGLvlup. We ask your age during setup
      and do not create accounts below that age. [[Some countries set a higher digital-consent age —
      confirm the threshold for the markets you operate in.]]
    </p>

    <h2>Health disclaimer</h2>
    <p>
      GGLvlup is a wellness and motivation tool, <strong>not medical advice</strong> and not a substitute for a
      professional. You are responsible for your own health decisions. Consult a qualified professional, especially if
      you have a medical condition.
    </p>
    <p>
      The calorie, protein and target-weight numbers the app calculates are general estimates from a
      standard formula, not a personalised plan. We will not set a target below a healthy BMI, and we
      floor daily calorie targets — but those are crude safety limits, not clinical judgement.{" "}
      <strong>
        If you have or have had an eating disorder, please do not use a gamified weight-loss tracker
        without speaking to a professional first.
      </strong>
    </p>

    <h2>Premium &amp; payments</h2>
    <ul>
      <li>Some features require a paid Premium plan, processed by our payment provider (Whop).</li>
      <li>Prices and what's included are shown at the point of purchase and may change over time.</li>
      <li>
        <strong>Free trials auto-convert.</strong> Where a free trial is offered, it becomes a paid
        plan at the end of the trial period unless you cancel before it ends. The price and the date
        it converts are shown before you start it.
      </li>
      <li>
        <strong>Cancelling.</strong> Manage or cancel your plan at any time from your account with our
        payment provider — [[LINK TO THE WHOP CUSTOMER PORTAL]]. Cancelling stops future charges;
        you keep Premium until the paid period ends.
      </li>
      <li>
        <strong>Refunds and the right to cancel.</strong> Where the law gives you a right to withdraw
        from a purchase — for example the 14-day right for consumers in the EU and UK — that right
        applies and nothing here limits it. Note that by starting to use Premium immediately you may
        be asked to acknowledge that the service begins before the withdrawal period expires.
        Otherwise, refunds follow our payment provider's policy.{" "}
        [[Have a lawyer confirm this against the consumer law of the markets you sell into.]]
      </li>
    </ul>

    <h2>Fair play</h2>
    <p>
      Challenges are competitive, sometimes with rewards agreed between participants. Don't
      manipulate your data, your XP or the leaderboard, and don't attempt to interfere with the
      scoring. We may void results or suspend accounts that do.
    </p>

    <h2>Your content</h2>
    <p>
      Your logged data belongs to you. You grant us the limited permission needed to store and display it back to you
      and to operate features you use. In particular, joining a challenge shows other members of that
      challenge your nickname, quest XP, average steps, exercise days and percentage weight change —
      see the Privacy Policy for exactly what is and isn't shared.
    </p>
    <p>
      You can download all of your logged data as a CSV at any time, on any plan, from{" "}
      <em>Analytics &amp; Export → Download my data</em>.
    </p>

    <h2>Availability &amp; "as is"</h2>
    <p>
      We work to keep GGLvlup running but provide it <strong>"as is"</strong>, without warranties of any kind. We are
      not liable for indirect or consequential damages arising from use of the app, to the extent permitted by law.
    </p>

    <h2>Termination</h2>
    <p>
      You can delete your account at any time from <em>Update Profile → Delete account</em>. We may suspend or terminate
      accounts that violate these terms.
    </p>

    <h2>Changes</h2>
    <p>We may update these terms; continued use after an update means you accept the revised terms.</p>

    <h2>Contact</h2>
    <p>
      Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
    </p>
  </LegalLayout>
);

export default Terms;
