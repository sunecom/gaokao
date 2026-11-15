"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SchoolLevel {
  id: string;
  label: string;
  description: string;
  confidence_note: string;
}

interface EstimateResult {
  estimated_rank_min: number;
  estimated_rank_max: number;
  estimated_rank_median: number;
  confidence: string;
  note: string;
  school_level_name?: string;
  input: { province: string; track: string; school_level: string; rank_in_school: number; total_students: number };
  school_percentile: string;
  disclaimer: string;
}

const PROVINCES = ["河南", "北京", "天津", "上海", "河北", "山西", "山东", "江苏", "浙江", "安徽", "福建", "江西", "湖北", "湖南", "广东", "广西", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "辽宁", "吉林", "黑龙江", "内蒙古", "新疆", "宁夏", "西藏"];

const CONFIDENCE_COLORS: Record<string, string> = {
  "较高": "bg-green-100 text-green-700 border-green-200",
  "中等": "bg-amber-100 text-amber-700 border-amber-200",
  "较低": "bg-red-100 text-red-700 border-red-200",
};

export default function RankEstimatePage() {
  const router = useRouter();
  const [levels, setLevels] = useState<SchoolLevel[]>([]);
  const [form, setForm] = useState({
    province: "河南",
    track: "physics",
    school_level: "",
    rank_in_school: "",
    total_students: "",
  });
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 加载配置
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/rank-estimate");
        if (res.ok) {
          const data = await res.json();
          setLevels(data.school_levels || []);
          if (data.school_levels?.length > 0) {
            setForm((prev) => ({ ...prev, school_level: data.school_levels[0].id }));
          }
        }
      } catch {
        // silent
      }
    }
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/rank-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          province: form.province,
          track: form.track,
          school_level: form.school_level,
          rank_in_school: parseInt(form.rank_in_school),
          total_students: parseInt(form.total_students),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const err = await res.json();
        setError(err.error || "请求失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 px-6 py-12">
      <div className="max-w-xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">📐</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            校内排名→省位次估算
          </h1>
          <p className="text-sm text-slate-500">
            根据校内排名和高中层次，估算你在全省的大致位次范围
          </p>
        </div>

        {/* 表单 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">省份</label>
                <select
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                >
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">科类</label>
                <select
                  value={form.track}
                  onChange={(e) => setForm({ ...form, track: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                >
                  <option value="physics">物理类</option>
                  <option value="history">历史类</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">高中层次</label>
              <div className="space-y-2">
                {levels.map((level) => (
                  <label
                    key={level.id}
                    className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                      form.school_level === level.id
                        ? "border-sky-400 bg-sky-50"
                        : "border-slate-200 hover:border-sky-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="school_level"
                      value={level.id}
                      checked={form.school_level === level.id}
                      onChange={(e) => setForm({ ...form, school_level: e.target.value })}
                      className="mt-0.5 accent-sky-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{level.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{level.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">你的校内排名</label>
                <input
                  type="number"
                  placeholder="例如：50"
                  value={form.rank_in_school}
                  onChange={(e) => setForm({ ...form, rank_in_school: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">年级总人数</label>
                <input
                  type="number"
                  placeholder="例如：1000"
                  value={form.total_students}
                  onChange={(e) => setForm({ ...form, total_students: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  required
                  min="1"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? "估算中..." : "开始估算 →"}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* 结果 */}
        {result && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-sky-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">📊 估算结果</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-sky-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">最乐观</p>
                <p className="text-2xl font-bold text-sky-700">
                  {result.estimated_rank_min.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">名</p>
              </div>
              <div className="text-center p-4 bg-indigo-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">中位估算</p>
                <p className="text-2xl font-bold text-indigo-700">
                  {result.estimated_rank_median.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">名</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">最保守</p>
                <p className="text-2xl font-bold text-amber-700">
                  {result.estimated_rank_max.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">名</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">校内排名百分比：</span>
                <span className="font-medium">{result.school_percentile}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">高中层次：</span>
                <span className="font-medium">{result.school_level_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">置信度：</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${CONFIDENCE_COLORS[result.confidence] || "bg-gray-100 text-gray-600"}`}>
                  {result.confidence}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">💡 {result.note}</p>
            </div>

            {/* 快捷跳转 */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500 mb-3">用估算的位次去填报</p>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/planner?province=${result.input.province}&rank=${result.estimated_rank_median}&track=${result.input.track}&year=2026`)}
                  className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  中位估算 → 智能填报
                </button>
                <button
                  onClick={() => router.push(`/planner?province=${result.input.province}&rank=${result.estimated_rank_min}&track=${result.input.track}&year=2026`)}
                  className="flex-1 py-2.5 bg-sky-100 hover:bg-sky-200 text-sky-700 text-sm font-medium rounded-xl transition-colors cursor-pointer"
                >
                  乐观估算 → 智能填报
                </button>
              </div>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              ⚠️ {result.disclaimer}
            </div>
          </div>
        )}

        {/* 返回 */}
        <div className="mt-6 text-center">
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
