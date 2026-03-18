"use client";

import { useState } from "react";

const HYPE_MESSAGES = [
  { text: "You managed international safety logistics across 4 countries. Most people never even get a passport. You're not unemployable — you're underdeployed.", emoji: "🚀" },
  { text: "You have an M.A. from Boston University, 6.5 years of diplomatic experience, and certifications most hiring managers can only dream of listing. The right door hasn't opened yet. That's all.", emoji: "🔑" },
  { text: "You coordinated programs for 1,000+ people. That's not 'just admin.' That's operations leadership at scale. Own it.", emoji: "💪" },
  { text: "They said 'overqualified.' Translation: they couldn't afford you. The highway is where you belong, not the rice field.", emoji: "🏎️" },
  { text: "11 countries. 7 languages. 50+ volunteers. 20+ annual programs. Read that again. That's your resume. You built that.", emoji: "✨" },
  { text: "The Ferrari doesn't belong in a typewriter shop. Today might feel slow, but you're heading for the highway.", emoji: "🛣️" },
  { text: "Johns Hopkins safety cert + BU M.A. + 6.5 years of real crisis management = a profile most global orgs would fight over. The search is temporary. Your skills are permanent.", emoji: "🌏" },
  { text: "You facilitated cross-cultural programs during a global pandemic. When the whole world stopped, you found a way to keep connecting people. That's leadership.", emoji: "🌟" },
  { text: "Tea ceremony instructor. TESOL certified. Crochet artist. You're not just qualified — you're interesting. The right team will see that.", emoji: "🍵" },
  { text: "好香ちゃん、大丈夫。ボストン大学の修士号を持って、4カ国の安全管理をやり遂げた人が「使えない」わけがない。世界はあなたを必要としている。今日も一歩前へ。", emoji: "🌸" },
  { text: "Tea Ceremony Instructor. Kimono Meister. Green Tea Instructor. Yoga Teacher. TESOL. That's not a resume — that's a cultural ambassador portfolio. You don't just work across cultures, you embody them.", emoji: "🎎" },
  { text: "You were honored as an Interlocal Human Resource. That's literally a government recognizing that you are a bridge between worlds. The next employer who says 'overqualified' clearly hasn't read the room.", emoji: "🏅" },
  { text: "13 certifications. Two degrees. Two continents. Seven languages in one newsletter. You didn't just check boxes — you built a career that most people can't even imagine. The right role is catching up to you.", emoji: "📜" },
  { text: "Kimono Dresser Instructor + Johns Hopkins Safety Cert. Name one other person on earth with that combination. You're not a generalist — you're uniquely qualified for roles that haven't been invented yet.", emoji: "🌺" },
  { text: "好香ちゃん、茶道と着物と安全管理とヨガと英語教育。全部できる人なんて世界中探してもほとんどいない。あなたは「何でも屋」じゃない。「何でもできる人」。それは強さ。", emoji: "🌟" },
];

export default function HypePage() {
  const [current, setCurrent] = useState(() =>
    HYPE_MESSAGES[Math.floor(Math.random() * HYPE_MESSAGES.length)]
  );
  const [animating, setAnimating] = useState(false);

  function refresh() {
    setAnimating(true);
    setTimeout(() => {
      setCurrent(HYPE_MESSAGES[Math.floor(Math.random() * HYPE_MESSAGES.length)]);
      setAnimating(false);
    }, 300);
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center max-w-lg animate-fade-up">
        {/* Breathing orb */}
        <div className="relative w-20 h-20 mx-auto mb-12">
          <div
            className="absolute inset-0 rounded-full bg-caution/20"
            style={{ animation: "breathe 6s ease-in-out infinite" }}
          />
          <div
            className="absolute inset-2 rounded-full bg-caution/30"
            style={{ animation: "breathe 6s ease-in-out infinite 0.5s" }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">
            {current.emoji}
          </div>
        </div>

        <p
          className={`font-serif text-2xl font-light leading-relaxed mb-10 transition-opacity duration-300 ${
            animating ? "opacity-0" : "opacity-100"
          }`}
        >
          {current.text}
        </p>

        <button
          onClick={refresh}
          className="px-8 py-3 text-sm bg-ink text-paper rounded-full hover:bg-ink/80 transition-all font-light"
        >
          Tell me again / もう一回
        </button>

        <p className="text-xs text-muted font-light mt-10">
          You&apos;ve got this. — Project Asago-to-the-Moon
        </p>
      </div>

      <style jsx>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
