"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Question {
  id: string;
  text: string;
  options: Array<{ value: string; label: string; traits: string[] }>;
}

interface Career {
  id: string;
  title: string;
  description: string;
  match_traits: string[];
  recommended_majors: string[];
  salary_range: string;
  demand_trend: string;
}

interface MatchResult {
  career: Career;
  score: number;
  matched_traits: string[];
  total_traits: number;
}

type PageState = "intro" | "questioning" | "result";

const TREND_COLORS: Record<string, string> = {
  "🔥": "bg-red-100 text-red-700",
  "📈": "bg-green-100 text-green-700",
  "✅": "bg-blue-100 text-blue-700",
  "🌟": "bg-amber-100 text-amber-700",
};

export default function CareerTestPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    traits: string[];
    personality_summary: string[];
    matches: MatchResult[];
    answer_details: Array<{ questionId: string; questionText: string; answerLabel: string }>;
  } | null>(null);

  // 加载问题配置
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/career-test");
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions || []);
        }
      } catch {
        // ignore
      }
    }
    load();
  }, []);

  // 选择答案
  const selectAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

    if (currentQ < questions.length - 1) {
      setCurrentQ((prev) => prev + 1);
    } else {
      submitTest({ ...answers, [questionId]: value });
    }
  };

  // 提交测评
  const submitTest = async (finalAnswers: Record<string, string>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/career-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setPageState("result");
      }
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  };

  // 重新测试
  const restart = () => {
    setPageState("intro");
    setCurrentQ(0);
    setAnswers({});
    setResults(null);
  };

  if (pageState === "intro") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-lg w-full text-center">
          <div className="text-6xl mb-6">🧠</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">
            性格与职业探索
          </h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            回答 8 道场景题，AI 帮你分析性格倾向，<br />
            推荐最适合你的职业方向和大学专业。
          </p>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8 text-left">
            <p className="text-sm font-medium text-slate-700 mb-3">⏱ 大约需要 3 分钟</p>
            <ul className="space-y-2 text-sm text-slate-500">
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">✦</span>
                <span>8 道选择题，没有对错之分</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">✦</span>
                <span>做完即出结果，推荐 5 个适配职业</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-indigo-500 mt-0.5">✦</span>
                <span>每个职业附带对应大学专业参考</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => setPageState("questioning")}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            开始测试 →
          </button>

          <div className="mt-6">
            <button
              onClick={() => router.back()}
              className="text-sm text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ← 返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "questioning") {
    const q = questions[currentQ];
    if (!q) return <div className="text-center py-20 text-slate-400">加载中...</div>;

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-xl w-full">
          {/* 进度条 */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
              <span>第 {currentQ + 1} / {questions.length} 题</span>
              <span>{Math.round(((currentQ + 1) / questions.length) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 题目 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-6 leading-relaxed">
              {q.text}
            </h2>
            <div className="space-y-3">
              {q.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => selectAnswer(q.id, opt.value)}
                  className="w-full text-left px-5 py-4 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer group"
                >
                  <span className="text-sm text-slate-700 group-hover:text-indigo-700">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "result" && results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {/* 性格画像 */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">
              你的性格画像
            </h1>
            <div className="flex justify-center gap-2 flex-wrap">
              {results.personality_summary.map((trait) => (
                <span
                  key={trait}
                  className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium"
                >
                  {trait}
                </span>
              ))}
            </div>
            <p className="text-sm text-slate-400 mt-4">
              你的核心特质：{results.traits.join("、")}
            </p>
          </div>

          {/* 回答回顾 */}
          <details className="mb-8">
            <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
              查看你的选择
            </summary>
            <div className="mt-3 space-y-2 bg-white rounded-xl p-4 text-sm">
              {results.answer_details.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-indigo-500 shrink-0">Q{i + 1}.</span>
                  <span className="text-slate-600">{d.answerLabel}</span>
                </div>
              ))}
            </div>
          </details>

          {/* 职业推荐 */}
          <h2 className="text-xl font-bold text-slate-800 mb-6">
            🔍 推荐职业（按匹配度排序）
          </h2>
          <div className="space-y-4">
            {results.matches.map((match, i) => {
              const trendKey = Object.keys(TREND_COLORS).find((k) =>
                match.career.demand_trend.startsWith(k)
              );
              return (
                <div
                  key={match.career.id}
                  className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">
                        {i + 1}. {match.career.title}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {match.career.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-2xl font-bold text-indigo-600">
                        {match.score}%
                      </div>
                      <div className="text-xs text-slate-400">匹配度</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-slate-500">💰 {match.career.salary_range}</span>
                    {trendKey && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          TREND_COLORS[trendKey] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {match.career.demand_trend}
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 mb-1">推荐专业</p>
                    <div className="flex flex-wrap gap-1.5">
                      {match.career.recommended_majors.map((major) => (
                        <span
                          key={major}
                          className="text-xs px-2 py-0.5 bg-sky-50 text-sky-600 rounded-full border border-sky-100"
                        >
                          {major}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 操作按钮 */}
          <div className="mt-8 space-y-3">
            <button
              onClick={restart}
              className="w-full py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              重新测试
            </button>
            <button
              onClick={() => router.back()}
              className="w-full text-sm text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ← 返回高考决策引擎
            </button>
          </div>

          {/* 免责 */}
          <div className="mt-6 text-center text-xs text-slate-400">
            {results.matches.length > 0 && (
              <p>💡 本测评仅供参考，最终职业选择请结合个人实际情况综合判断</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔮</div>
          <p>正在分析你的性格特质...</p>
        </div>
      </div>
    );
  }

  return null;
}
