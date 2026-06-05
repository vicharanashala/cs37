import Header from "@/components/Header";

export default function OverviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        <div className="rounded-xl border border-amber-500/40 bg-zinc-900/60 p-6 sm:p-8 text-sm text-zinc-300 leading-relaxed space-y-6">

          {/* 📌 Overview */}
          <section>
            <h1 className="text-2xl font-bold text-zinc-100 mb-4">📌 Overview</h1>
            <p>
              The Vicharanashala internship is a two-month, full-attention engagement at the lab of Prof. Sudarshan Iyengar at IIT Ropar. We work on real, open-source software for India-centric problems such as agriculture (Annam.AI), education (ViBe), and other research-driven projects. This page explains the programme structure; the FAQ section handles operational questions.
            </p>
          </section>

          {/* 📍 The Programme */}
          <section>
            <h2 className="text-amber-400 font-semibold text-base mb-3">📍 The Programme</h2>
            <p className="mb-2">
              Every selected candidate receives a yellow VINS result panel after logging in to samagama.in. This panel contains all next-step instructions.
            </p>
            <p className="mb-1"><strong className="text-zinc-100">VINS — Online:</strong></p>
            <ul className="list-disc list-inside space-y-1 mb-2 text-zinc-400">
              <li>Open to candidates who perform well in the AI interview</li>
              <li>Fully online; work from your own location</li>
              <li>Start anytime in 2026</li>
              <li>Duration: 2 months + 1 month grace period</li>
              <li>Final deadline: 31 December 2026</li>
              <li>No stipend (program is completely free)</li>
            </ul>
          </section>

          {/* 🏆 Four-Badge Journey */}
          <section>
            <h2 className="text-amber-400 font-semibold text-base mb-3">🏆 Four-Badge Journey</h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>🥉 Bronze — Training phase (course or assignment based on mentor decision)</li>
              <li>🥈 Silver — Core internship phase with real open-source project work</li>
              <li>🥇 Gold — High-quality significant contribution during Silver phase</li>
              <li>🏆 Platinum — Invitation to return to the lab within 12 months (earned recognition)</li>
            </ul>
          </section>

          {/* 📊 What We Expect */}
          <section>
            <h2 className="text-amber-400 font-semibold text-base mb-3">📊 What We Expect</h2>
            <p className="mb-2">This is a serious full-time internship.</p>
            <ul className="list-disc list-inside space-y-1 mb-2 text-zinc-400">
              <li>6–10 hours of focused work per day</li>
              <li>Strict attendance monitoring</li>
              <li>Minimum 85% attendance in live sessions</li>
              <li>Minimum 85% participation in quizzes/polls</li>
              <li>Minimum 50% quiz performance required</li>
            </ul>
            <p>Failure to meet requirements may move candidate to a later batch.</p>
          </section>

          {/* 🧠 Project Approach */}
          <section>
            <h2 className="text-amber-400 font-semibold text-base mb-3">🧠 Project Approach</h2>
            <p className="mb-2">Projects are not pre-assigned.</p>
            <p className="mb-2">Mentors assign real lab problems based on skills. Candidates are expected to learn required technologies during execution.</p>
            <p className="mb-2">Possible domains include:</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>AI / ML / NLP / LLMs</li>
              <li>Web development</li>
              <li>Systems engineering</li>
              <li>Agriculture tech (Annam.AI)</li>
              <li>Education tech (ViBe)</li>
              <li>Open-source infrastructure</li>
            </ul>
          </section>

          {/* 🎤 Interview Process */}
          <section>
            <h2 className="text-amber-400 font-semibold text-base mb-3">🎤 Interview Process</h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>AI interview conducted on samagama.in using Yaksha</li>
              <li>No separate exam or coding test</li>
              <li>Transcript reviewed by Prof. Iyengar personally</li>
            </ul>
          </section>

          {/* ⚙️ Logistics */}
          <section>
            <h2 className="text-amber-400 font-semibold text-base mb-3">⚙️ Logistics</h2>
            <ul className="list-disc list-inside space-y-1 mb-3 text-zinc-400">
              <li>Result panel appears on samagama.in</li>
              <li>Candidate must opt into VINS</li>
              <li>NOC required (signed &amp; stamped physical copy only)</li>
              <li>Offer letter issued after validation</li>
            </ul>
            <p className="text-zinc-300">Tools used: Discord, Zoom, GitHub, Yaksha</p>
          </section>

          {/* 💰 Cost */}
          <section>
            <h2 className="text-amber-400 font-semibold text-base mb-3">💰 Cost</h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Internship is completely free</li>
              <li>No fees for training, mentorship, or access</li>
              <li>Funded through external research initiatives</li>
            </ul>
          </section>

          {/* 🚀 Next Steps */}
          <section>
            <h2 className="text-amber-400 font-semibold text-base mb-3">🚀 Next Steps</h2>
            <ol className="list-decimal list-inside space-y-1 text-zinc-400">
              <li>Login to samagama.in</li>
              <li>Read result panel carefully</li>
              <li>Opt into VINS</li>
              <li>Submit NOC (printed, signed, stamped)</li>
              <li>Wait for offer letter</li>
              <li>Start internship</li>
            </ol>
          </section>

        </div>
      </main>
    </div>
  );
}
