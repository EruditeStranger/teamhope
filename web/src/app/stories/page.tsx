"use client";

import { useState } from "react";

interface Story {
  title: string;
  titleJp: string;
  en: { situation: string; task: string; action: string; result: string };
  jp: { situation: string; task: string; action: string; result: string };
  tags: string[];
}

const STORIES: Story[] = [
  {
    title: "The High-Stakes Crisis Manager",
    titleJp: "極限状態の危機管理能力（シンガポール）",
    en: {
      situation: "Provided residential support for a visiting student group at Singapore Polytechnic.",
      task: "Manage emergency response and cultural friction in a foreign residential environment.",
      action: "Acted as the primary first responder for safety issues while facilitating communication workshops to de-escalate cultural tensions.",
      result: "Ensured 100% safety and program completion with positive feedback on culturally responsive curriculum implementation.",
    },
    jp: {
      situation: "シンガポール・ポリテクニックにて、海外研修生のレジデンシャル・サポートを担当。",
      task: "異国の地での緊急事態への即応と、学生間の文化摩擦の解消。",
      action: "安全確保の第一対応者として機能しつつ、コミュニケーション・ワークショップを主催し、文化的な対立を緩和。",
      result: "参加者全員の安全を確保し、プログラムを完遂。文化に配慮したカリキュラム運営に対し高い評価を得た。",
    },
    tags: ["crisis", "safety", "cross-cultural"],
  },
  {
    title: "The Diplomatic Liaison",
    titleJp: "外交的リエゾン（姫路市姉妹都市外交）",
    en: {
      situation: "Hosting international delegations and managing youth exchanges for Himeji City.",
      task: "Maintain diplomatic ties across multiple continents while ensuring VIPs and students have a flawless experience.",
      action: "Prepared meticulous briefing materials, managed hospitality for municipal leaders, and arranged immersion workshops.",
      result: "Strengthened sustainable diplomatic partnerships and successfully coordinated 20+ annual programs without logistical failure.",
    },
    jp: {
      situation: "姫路市における海外訪問団の接遇および青少年派遣事業の運営。",
      task: "複数の大陸にまたがる姉妹都市との外交関係を維持しつつ、要人や学生に完璧な体験を提供すること。",
      action: "緻密なブリーフィング資料作成、自治体リーダーの接遇管理、茶道などの文化体験プログラムの企画・運営。",
      result: "持続可能な外交パートナーシップを強化し、年間20件以上の事業をロジスティクスのミスなく完遂。",
    },
    tags: ["diplomacy", "coordination", "VIP"],
  },
  {
    title: "The Pandemic Pivot",
    titleJp: "コロナ禍でのプログラム再設計",
    en: {
      situation: "When COVID-19 triggered a global shutdown in 2020, every scheduled international travel program faced sudden cancellation. The continuity of Himeji's sister-city partnerships and youth programming was at serious risk.",
      task: "Redesign the foundation's entire international exchange model from the ground up under emergency conditions, with no template to follow, while maintaining the diplomatic trust of international partners across multiple time zones.",
      action: "Took ownership of the program transformation by independently researching and prototyping virtual exchange formats. Adapted hands-on cultural programming — including tea ceremony instruction and language exchange sessions — into engaging online workshops, and established new coordination protocols with overseas partner organizations to align schedules across time zones. Built replicable frameworks so future programs could be delivered in either format.",
      result: "All sister-city diplomatic relationships were preserved through the crisis period with zero program cancellations. The newly designed virtual model received enthusiastic feedback from participants in multiple countries and established the foundation as an early adopter of resilient, hybrid exchange programming.",
    },
    jp: {
      situation: "2020年、新型コロナウイルスの感染拡大により全ての海外渡航プログラムが突然停止。長年かけて築いた姉妹都市関係と青少年交流事業の継続が、根本から問い直される事態となった。",
      task: "前例のない状況下で、財団の国際交流モデル全体を緊急再設計し、複数の時差がある海外パートナー機関との信頼関係を維持すること。",
      action: "自らイニシアティブを取り、オンライン交流形式のリサーチとプロトタイプ開発に着手。茶道体験や語学交流といった対面プログラムをオンラインワークショップ形式に再構築し、時差を考慮した海外機関との新たな調整体制を確立。さらに、対面・オンライン双方に対応可能な再現性のある運営フレームワークを構築した。",
      result: "危機的状況においても全ての姉妹都市外交関係を維持し、プログラムのキャンセルはゼロ。新設したオンラインモデルは複数の国の参加者から高い評価を受け、財団はハイブリッド型交流プログラムの先進的な実践機関として認知されることとなった。",
    },
    tags: ["innovation", "crisis", "program design"],
  },
  {
    title: "The 7-Language Newsletter",
    titleJp: "7言語ニュースレター",
    en: {
      situation: "Himeji's growing international resident population spanned dozens of nationalities, yet critical city-life information was only reliably reaching English and Japanese speakers. Vietnamese, Portuguese, and Mandarin-speaking residents were structurally underserved.",
      task: "Design and operationalize a multilingual communication system that would reach every international resident regardless of language background, while managing quality, consistency, and a volunteer-dependent production process.",
      action: "Coordinated the end-to-end production of a multilingual community newsletter in 7 languages — Japanese, English, Mandarin, Vietnamese, Spanish, Portuguese, and Plain Japanese (やさしい日本語) — by building and managing a network of volunteer translators. Established editorial guidelines to ensure informational consistency across all versions, created review checkpoints to maintain accuracy, and managed production timelines across a distributed, non-professional contributor base.",
      result: "The newsletter became a recognized model for inclusive municipal communication in the region. Previously unreached language communities gained reliable access to essential local information, measurably strengthening trust between international residents and local government institutions.",
    },
    jp: {
      situation: "姫路市の外国人居住者コミュニティは多国籍化が進む一方、緊急連絡・行政手続き・地域情報などの重要情報が英語・日本語話者にしか届いていないという構造的な課題があった。ベトナム語・ポルトガル語・中国語話者など、多くの住民が情報から取り残されていた。",
      task: "言語背景を問わず全ての外国人住民に必要な情報を届ける多言語コミュニケーション体制を設計・運用し、ボランティア依存の制作プロセスで品質と一貫性を担保すること。",
      action: "日本語・英語・中国語・ベトナム語・スペイン語・ポルトガル語・やさしい日本語の7言語で発行する地域ニュースレターの制作を統括。ボランティア翻訳者のネットワークを構築・管理し、全言語版での情報の一貫性を確保するための編集指針を策定。校正チェックポイントを設け、非専門家チームでの正確な制作フローを確立した。",
      result: "このニュースレターは地域における包括的な行政コミュニケーションのモデルケースとして評価されるようになった。これまで情報にアクセスできなかった言語コミュニティが地域情報を継続的に入手できる環境が整い、外国人住民と行政の間の信頼関係が具体的に強化された。",
    },
    tags: ["multilingual", "volunteers", "inclusion"],
  },
  {
    title: "The 1,000-Person Festival",
    titleJp: "千人規模の国際フェスティバル",
    en: {
      situation: "Himeji's annual international friendship festival was the flagship public expression of the city's global identity — a high-visibility, high-complexity event involving over 1,000 participants, 30+ volunteer groups, multiple performance stages, food vendors, and cultural exhibition booths.",
      task: "Serve as a central operational coordinator responsible for the full event lifecycle, from pre-event planning through day-of execution, while managing a large, multi-stakeholder volunteer ecosystem and maintaining safety and scheduling integrity at scale.",
      action: "Owned end-to-end event operations including volunteer recruitment, role assignment, and pre-event training; vendor onboarding and coordination; detailed schedule management across simultaneous program tracks; and the development of day-of crisis response protocols. Established communication hierarchies so issues could be escalated and resolved in real time without disrupting the participant experience.",
      result: "Delivered the festival without logistical failures across multiple consecutive years. Community participation grew year-over-year, and the event consistently reinforced Himeji's reputation as one of the Kansai region's most internationally welcoming cities. The operational playbooks developed became institutional assets for future events.",
    },
    jp: {
      situation: "姫路市の年次国際親善フェスティバルは、市の国際都市としての象徴的なイベント。参加者1,000人超、30以上のボランティアグループ、複数のステージ、飲食ブース、姉妹都市の文化展示が同時進行する、高い可視性と複雑性を持つ事業だった。",
      task: "企画段階から当日の運営まで、大規模な多ステークホルダー環境でのイベント全体を統括し、安全性とスケジュール管理の精度を維持すること。",
      action: "ボランティアの募集・役割配置・事前研修、出店者の調整、複数同時進行プログラムの詳細なスケジュール管理、当日の緊急対応プロトコルの策定まで、運営の全工程を担当。問題発生時に参加者体験を損なわずリアルタイムで対処できるよう、明確な報告・指示系統を設計した。",
      result: "複数年にわたりロジスティクス上の問題なくフェスティバルを完遂。年々参加者数が増加し、姫路市は関西における国際都市としての評価をさらに高めた。開発した運営マニュアルは財団の組織的な資産として次年度以降も活用されている。",
    },
    tags: ["operations", "large-scale", "events"],
  },
  {
    title: "The Young Ambassadors",
    titleJp: "未来の国際人育成プログラム",
    en: {
      situation: "In a relatively homogeneous local community, elementary school students had limited exposure to global perspectives or direct interaction with people from other cultures.",
      task: "Independently design and deliver a developmentally appropriate, multi-session global awareness curriculum for 30 elementary school students, building genuine cultural empathy while keeping it engaging.",
      action: "Created a structured multi-session curriculum combining experiential and classroom-based learning: field trips to international cultural sites, a speaker series from 11+ countries, hands-on cultural workshops (cooking, crafts, language games), and student presentation projects to synthesize their learning.",
      result: "Students demonstrated measurably increased global awareness, cultural curiosity, and presentation confidence. School administrators and parents praised the initiative. The program was incorporated as a recurring annual offering.",
    },
    jp: {
      situation: "外国人住民が比較的少ない地域の小学校では、子どもたちが異文化や多様な価値観に触れる機会が極めて限られており、次世代の国際感覚を育む教育環境の整備が課題となっていた。",
      task: "30名の小学生を対象に、発達段階に合わせた体験型のグローバル教育カリキュラムを独自に設計・実施し、知識習得と感性の両面から国際的な視野を育てること。",
      action: "複数回にわたる体験型・座学型を組み合わせたカリキュラムを一から構築。国際文化施設への校外学習、11カ国以上の人々を招いたゲストスピーカーシリーズ、料理・工芸・語学ゲームなどのハンズオン文化体験、そして子どもたちが学びを発表する個人・グループ発表プロジェクトを組み合わせた包括的なプログラムを企画・進行した。",
      result: "プログラム終了時には、参加した児童に国際的な関心と文化的な共感力、そして発表力の向上が見られた。学校管理職と保護者から内容・実施の両面で高い評価を受け、翌年からは年次プログラムとして正式に継続採用。地域の教育コミュニティにおける国際教育の基盤として定着することとなった。",
    },
    tags: ["education", "curriculum", "community"],
  },
];

const STAR_LABELS = {
  en: {
    situation: { letter: "S", label: "Situation", color: "text-calm" },
    task: { letter: "T", label: "Task", color: "text-caution" },
    action: { letter: "A", label: "Action", color: "text-accent" },
    result: { letter: "R", label: "Result", color: "text-calm" },
  },
  jp: {
    situation: { letter: "状", label: "状況", color: "text-calm" },
    task: { letter: "課", label: "課題", color: "text-caution" },
    action: { letter: "行", label: "行動", color: "text-accent" },
    result: { letter: "結", label: "結果", color: "text-calm" },
  },
};

type Lang = "en" | "jp";
type PageMode = "star" | "intro";

const SELF_INTROS = {
  short: {
    label: { en: "Quick / 30 sec", jp: "短め・30秒" },
    en: "My name is Sumika Moriwaki. I'm an international program leader with six and a half years of experience managing large-scale exchange operations across eleven countries, and a Master's in International Relations from Boston University. I'm looking for a role where I can put that operational and cross-cultural expertise to work. Thank you for your time today.",
    jp: "森脇好香と申します。本日はよろしくお願いいたします。\n姫路市の国際交流財団にて6年半にわたり、11カ国を対象とした国際交流事業の企画・運営を統括してまいりました。現在は、その経験を活かせる国際業務のポジションを探しております。\nどうぞよろしくお願いいたします。",
  },
  standard: {
    label: { en: "Standard / 1 min", jp: "標準・1分" },
    en: "My name is Sumika Moriwaki. For six and a half years, I led international exchange programs at the Himeji Cultural and International Exchange Foundation — managing an eleven-country portfolio, coordinating over a thousand participants annually, and building a volunteer network of more than fifty people.\n\nI didn't just run logistics. I managed end-to-end Duty of Care for youth delegations traveling to four countries, published a seven-language community newsletter, and served as a diplomatic liaison for Himeji's sister-city relationships.\n\nLast year I completed my Master's in International Relations at Boston University's Pardee School, because I wanted the analytical framework to match my operational experience. Now I'm back in Kansai and looking for a role where both of those dimensions — the hands-on leadership and the strategic thinking — come together.\n\nThank you for the opportunity to speak with you today.",
    jp: "森脇好香と申します。本日はよろしくお願いいたします。\n私は姫路市の国際交流財団にて6年半、国際交流事業の企画・運営に携わってまいりました。11カ国を対象としたプログラムの統括、年間1,000名を超える参加者の対応、50名以上のボランティアネットワークの構築と運営を担当し、姉妹都市外交の実務にも深く関わってまいりました。\n\n特に、ベルギー・オーストラリア・韓国・シンガポールの4カ国への青少年派遣では、安全管理の全責任を担い、危機対応を含むデューティ・オブ・ケアを遂行いたしました。\n\nこれらの実務経験をさらに深めたいと考え、昨年、ボストン大学パーディースクールにて国際関係学の修士号を取得いたしました。現場での実践力と、大学院で培った分析的な視点の両方を活かせるポジションを探しております。\n\n本日はどうぞよろしくお願いいたします。",
  },
  global: {
    label: { en: "Global focus / 1.5 min", jp: "グローバル重視・1分半" },
    en: "My name is Sumika Moriwaki. I'm an international operations professional with six and a half years of hands-on program leadership and a Master's in International Relations from Boston University.\n\nAt the Himeji Cultural and International Exchange Foundation, I managed a portfolio spanning eleven countries — from Belgium and Australia to South Korea and Singapore. I coordinated over a thousand participants annually, led a network of fifty-plus volunteers, and produced a seven-language newsletter reaching Himeji's entire international resident community.\n\nOne of the areas I'm most proud of is safety management. I held end-to-end responsibility for Duty of Care across four countries — not in a supervisory sense, but as the person making real-time risk decisions, managing crisis protocols, and ensuring every participant came home safe. That experience led me to earn the Johns Hopkins International Travel Safety certification.\n\nI pursued my M.A. at Boston University specifically to build the policy analysis and research skills that would complement my operational background. I wanted to be someone who can both design a program and assess its strategic impact.\n\nI also hold certifications in tea ceremony instruction, kimono arts, and Japanese language teaching — skills I've used professionally in cultural diplomacy contexts.\n\nI'm now seeking a role in international program management, global operations, or cross-cultural coordination — ideally with an organization that values both execution capability and cultural depth. Thank you very much for your time today.",
    jp: "森脇好香と申します。本日はよろしくお願いいたします。\n私は姫路市の国際交流財団にて6年半にわたり、国際交流事業全般の企画・運営を統括してまいりました。ベルギー、オーストラリア、韓国、シンガポールをはじめとする11カ国を対象としたプログラムを担当し、年間1,000名以上の参加者対応、50名以上のボランティアの統括、そして7言語での地域ニュースレターの制作を行ってまいりました。\n\n中でも力を入れてきたのが、海外派遣における安全管理です。4カ国への青少年派遣事業において、リスク評価から緊急時対応まで、デューティ・オブ・ケアの全工程を担いました。この経験を体系化するために、ジョンズ・ホプキンス大学の国際渡航安全プログラムも修了しております。\n\nまた、現場での経験を政策的・分析的な視点から深めたいと考え、昨年ボストン大学パーディースクールにて国際関係学の修士号を取得いたしました。現場のオペレーション力と、学術的な分析力の両方を備えた人材でありたいと考えております。\n\nなお、茶道や着物、日本語教育の資格も保有しており、これらは文化外交の現場で実際に活用してきたスキルでもございます。\n\n現在は、国際事業の企画・運営、グローバルオペレーション、または異文化間の調整業務に携われるポジションを探しております。実行力と文化的な深みの両方を重視してくださる組織で、お力になれればと考えております。\n\n本日はどうぞよろしくお願いいたします。",
  },
} as const;

type IntroKey = keyof typeof SELF_INTROS;

export default function StoriesPage() {
  const [pageMode, setPageMode] = useState<PageMode>("star");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [practiceMode, setPracticeMode] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [revealedParts, setRevealedParts] = useState<Set<string>>(new Set());
  const [activeIntro, setActiveIntro] = useState<IntroKey>("standard");
  const [copied, setCopied] = useState(false);

  function toggleReveal(key: string) {
    setRevealedParts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function copyIntro() {
    const text = SELF_INTROS[activeIntro][lang];
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const labels = STAR_LABELS[lang];

  return (
    <div className="max-w-3xl animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="font-serif text-4xl font-light tracking-tight mb-1">
            {lang === "en" ? "Story Coach" : "ストーリー練習"}
          </h2>
          <p className="text-sm text-muted font-light">
            {lang === "en"
              ? "ストーリー練習 — Practice your STAR narratives"
              : "Story Coach — STARメソッドで面接準備"}
          </p>
        </div>

        {/* Language toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => { setLang("en"); setRevealedParts(new Set()); }}
            className={`px-4 py-2.5 text-sm font-light transition-colors ${
              lang === "en" ? "bg-ink text-paper" : "bg-white text-muted hover:bg-paper-warm"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => { setLang("jp"); setRevealedParts(new Set()); }}
            className={`px-4 py-2.5 text-sm font-light transition-colors ${
              lang === "jp" ? "bg-ink text-paper" : "bg-white text-muted hover:bg-paper-warm"
            }`}
          >
            JP
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-8">
        <button
          onClick={() => setPageMode("star")}
          className={`px-5 py-2.5 text-sm rounded-lg font-light transition-colors ${
            pageMode === "star" ? "bg-ink text-paper" : "bg-white border border-border text-muted hover:text-ink"
          }`}
        >
          {lang === "en" ? "STAR Stories" : "STARストーリー"}
        </button>
        <button
          onClick={() => setPageMode("intro")}
          className={`px-5 py-2.5 text-sm rounded-lg font-light transition-colors ${
            pageMode === "intro" ? "bg-ink text-paper" : "bg-white border border-border text-muted hover:text-ink"
          }`}
        >
          {lang === "en" ? "Self Introduction" : "自己紹介"}
        </button>
      </div>

      {/* ── STAR Stories ── */}
      {pageMode === "star" && (
        <>
          <div className="flex justify-end mb-6">
            <button
              onClick={() => { setPracticeMode(!practiceMode); setRevealedParts(new Set()); }}
              className={`px-5 py-2.5 text-sm rounded-lg transition-colors font-light ${
                practiceMode ? "bg-caution text-white" : "bg-white border border-border text-muted hover:text-ink"
              }`}
            >
              {practiceMode
                ? (lang === "en" ? "Exit Practice" : "終了")
                : (lang === "en" ? "Practice Mode" : "練習モード")}
            </button>
          </div>

          {practiceMode && (
            <div className="bg-caution-soft border border-caution/20 rounded-lg p-5 mb-6 text-sm font-light animate-fade-up">
              {lang === "en" ? (
                <>Click each S / T / A / R part to reveal it. Try to recall from memory first.<br />
                <span className="text-muted text-xs">各パートをクリックして表示。まず記憶から思い出してみてください。</span></>
              ) : (
                <>各パート（状況・課題・行動・結果）をクリックして表示します。まず自分の言葉で思い出してから確認しましょう。<br />
                <span className="text-muted text-xs">Click each part to reveal. Try to recall from memory first.</span></>
              )}
            </div>
          )}

          <div className="space-y-3 animate-fade-up delay-1">
            {STORIES.map((story, idx) => (
              <div key={idx} className="bg-white border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === idx ? null : idx)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-paper transition-colors"
                >
                  <div>
                    <span className="font-serif text-lg font-light">
                      {lang === "en" ? story.title : story.titleJp}
                    </span>
                    <span className="text-xs text-muted ml-3">
                      {lang === "en" ? story.titleJp : story.title}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {story.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2.5 py-1 bg-paper-warm rounded-full text-muted font-light">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>

                {expanded === idx && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                    {(["situation", "task", "action", "result"] as const).map((part) => {
                      const key = `${idx}-${part}-${lang}`;
                      const isRevealed = !practiceMode || revealedParts.has(key);
                      const meta = labels[part];
                      const content = story[lang][part];
                      return (
                        <div
                          key={part}
                          className={`flex items-start gap-3 ${practiceMode ? "cursor-pointer" : ""}`}
                          onClick={() => practiceMode && toggleReveal(key)}
                        >
                          <div className="w-14 shrink-0 pt-0.5">
                            <span className={`label-caps ${meta.color}`}>{meta.letter}</span>
                            <span className="text-[9px] text-muted block">{meta.label}</span>
                          </div>
                          <p className={`text-sm font-light leading-relaxed transition-all duration-300 ${
                            isRevealed ? "" : "blur-sm select-none"
                          }`}>
                            {content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Self Introduction ── */}
      {pageMode === "intro" && (
        <div className="animate-fade-up">
          <div className="bg-calm-soft border border-calm/20 rounded-lg p-5 mb-8 text-sm font-light">
            {lang === "en" ? (
              <>These are <strong className="font-medium">starting points, not scripts</strong> — adapt them to fit your voice and the specific role. Use whichever length feels right for the moment.<br />
              <span className="text-muted text-xs mt-1 block">これらはあくまでインスピレーションです。自分の言葉でアレンジしてください。</span></>
            ) : (
              <>これらは<strong className="font-medium">インスピレーションのためのサンプル</strong>です。そのまま暗記するのではなく、自分の言葉でアレンジして使ってください。<br />
              <span className="text-muted text-xs mt-1 block">These are starting points — adapt them to fit your voice and the specific role.</span></>
            )}
          </div>

          {/* Length selector */}
          <div className="flex gap-1 mb-6">
            {(Object.keys(SELF_INTROS) as IntroKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveIntro(key)}
                className={`px-4 py-2 text-xs rounded-lg font-light transition-colors ${
                  activeIntro === key
                    ? "bg-calm text-white"
                    : "bg-white border border-border text-muted hover:text-ink"
                }`}
              >
                {SELF_INTROS[key].label[lang]}
              </button>
            ))}
          </div>

          {/* Script display */}
          <div className="bg-white border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <span className="label-caps">{SELF_INTROS[activeIntro].label[lang]}</span>
              <button
                onClick={copyIntro}
                className="text-xs text-muted hover:text-ink transition-colors font-light flex items-center gap-1.5"
              >
                {copied ? (lang === "en" ? "Copied ✓" : "コピー済 ✓") : (lang === "en" ? "Copy" : "コピー")}
              </button>
            </div>
            <div className="space-y-4">
              {SELF_INTROS[activeIntro][lang].split("\n\n").map((para, i) => (
                <p key={i} className="text-sm font-light leading-relaxed text-ink">
                  {para.split("\n").map((line, j) => (
                    <span key={j}>
                      {line}
                      {j < para.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
