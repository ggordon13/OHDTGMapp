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

    <h2>Health disclaimer</h2>
    <p>
      GGLvlup is a wellness and motivation tool, <strong>not medical advice</strong> and not a substitute for a
      professional. You are responsible for your own health decisions. Consult a qualified professional, especially if
      you have a medical condition.
    </p>

    <h2>Premium &amp; payments</h2>
    <ul>
      <li>Some features require a paid Premium plan, processed by our payment provider (Whop).</li>
      <li>Prices and what's included are shown at the point of purchase and may change over time.</li>
      <li>
        A free trial, where offered, converts to the described plan unless cancelled per the payment provider's terms.
        Refunds follow the provider's policy and applicable law.
      </li>
    </ul>

    <h2>Your content</h2>
    <p>
      Your logged data belongs to you. You grant us the limited permission needed to store and display it back to you
      and to operate features you use (e.g. challenge leaderboards show aggregate results to challenge members).
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
