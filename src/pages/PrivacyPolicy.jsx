export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-1">Dianoose Stage — Last updated July 22, 2026</p>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Dianoose Stage is a chord chart and scheduling app for church worship teams. Here's what
          we collect and why, in plain terms.
        </p>

        <Section title="What we collect">
          <p>
            Your name and email, and your church's info (name, service schedule, team code). The
            songs, charts, service plans, and messages you and your team create in the app. If you
            sign in with Google or Apple, we get the name/email/photo they share with us. We don't
            run analytics or ad tracking of any kind.
          </p>
        </Section>

        <Section title="Who else sees it">
          <p>
            Content you add is shared with your own church team — that's the whole point. It's not
            visible to other churches on the app. We use Firebase (Google) to run the app, Google's
            Gemini to read chart photos you scan in, Spotify to look up song info, and Resend to send
            account emails. None of them get more than they need to do their job.
          </p>
        </Section>

        <Section title="Chart content & licensing">
          <p>
            Charts and lyrics are transcribed or uploaded by your team. Making sure your church has
            the right to use those songs (e.g. a CCLI license) is on you, not us.
          </p>
        </Section>

        <Section title="Your data, your call">
          <p>
            Want your account and data deleted? Email us below and we'll take care of it. This app
            isn't meant for kids under 13, and we don't knowingly collect their info.
          </p>
        </Section>

        <Section title="Questions?">
          <p>
            Reach us at{" "}
            <a href="mailto:privacy@dianoosestage.com" className="text-primary hover:underline">
              privacy@dianoosestage.com
            </a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}
