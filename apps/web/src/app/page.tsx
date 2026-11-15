"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const PROVINCES = [
  "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江",
  "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南",
  "广东", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "台湾",
  "内蒙古", "广西", "西藏", "宁夏", "新疆",
];

const SUBJECT_TRACKS = [
  { value: "physics", label: "物理类 (3+1+2)" },
  { value: "history", label: "历史类 (3+1+2)" },
  { value: "science", label: "理科 (老高考)" },
  { value: "arts", label: "文科 (老高考)" },
  { value: "comprehensive", label: "综合改革 (3+3)" },
];

interface ConversionPreview {
  year: string;
  equivalent_score: number | null;
}

export default function HomePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    province: "",
    score: "",
    rank: "",
    track: "physics",
    year: "2026",
  });
  const [conversionPreview, setConversionPreview] = useState<ConversionPreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 位次输入后自动请求换算预览
  useEffect(() => {
    if (!form.rank || form.rank.length < 3 || !form.province) {
      setConversionPreview([]);
      return;
    }
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const trackMap: Record<string, string> = {
          physics: "物理类", history: "历史类",
          science: "理科", arts: "文科", comprehensive: "综合改革",
        };
        const res = await fetch(
          `/api/convert-rank?province=${form.province}&track=${trackMap[form.track] || "物理类"}&rank=${form.rank}&year=${form.year}`
        );
        if (res.ok) {
          const data = await res.json();
          setConversionPreview(data.equivalent || []);
        }
      } catch {
        // silent fail
      } finally {
        setPreviewLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.rank, form.province, form.track, form.year]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(form as any);
    router.push(`/planner?${params}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-sky-700 to-blue-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <h1 className="text-4xl font-bold mb-2">🎯 高考决策引擎</h1>
          <p className="text-sky-200 text-lg">
            AI 智能志愿填报 — 数据驱动，多维分析，精准推荐
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">
            输入高考成绩，开始智能规划
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {/* 省份 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">省份</label>
                <select
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  required
                >
                  <option value="">选择省份</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* 科类 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">科类 / 选科</label>
                <select
                  value={form.track}
                  onChange={(e) => setForm({ ...form, track: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                >
                  {SUBJECT_TRACKS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* 分数 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">高考总分</label>
                <input
                  type="number"
                  placeholder="例如：590"
                  value={form.score}
                  onChange={(e) => setForm({ ...form, score: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                />
              </div>

              {/* 位次 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">全省位次</label>
                <input
                  type="number"
                  placeholder="例如：35241"
                  value={form.rank}
                  onChange={(e) => setForm({ ...form, rank: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  required
                />
                {/* 实时换算预览 */}
                {conversionPreview.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {previewLoading && (
                      <span className="text-xs text-slate-400">换算中...</span>
                    )}
                    {!previewLoading && conversionPreview.map((cv) => (
                      <span key={cv.year} className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">
                        {cv.year}年 ≈ {cv.equivalent_score !== null ? `${cv.equivalent_score}分` : "暂无数据"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 年份 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">高考年份</label>
              <select
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
              >
                <option value="2026">2026 年</option>
                <option value="2025">2025 年</option>
                <option value="2024">2024 年</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl transition-colors cursor-pointer"
            >
              开始分析 →
            </button>
          </form>

          {/* 快捷导航 */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-sm text-slate-500 mb-3">其他功能</p>
            <div className="flex gap-3 flex-wrap">
              <a href="/schools" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors">
                🏫 院校探索
              </a>
              <a href="/majors" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors">
                📚 专业解读
              </a>
              <a href="/compare" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors">
                🔄 对比分析
              </a>
              <a href="/career-test" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors">
                🧠 性格测试
              </a>
              <a href="/rank-estimate" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors">
                📐 位次估算
              </a>
              <a href="/dashboard" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors">
                📊 数据看板
              </a>
            </div>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 text-center text-xs text-slate-400">
          <p>所有推荐仅供参考，最终以各省考试院官方数据为准</p>
          <p className="mt-1">© 2026 AiToMoney 团队</p>
        </div>
      </main>
    </div>
  );
}
