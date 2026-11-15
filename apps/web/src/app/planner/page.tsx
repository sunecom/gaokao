"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useCallback } from "react";

type Tier = "冲" | "小冲" | "稳" | "保" | "垫";

interface ConversionResult {
  year: string;
  equivalent_score: number | null;
  note: string;
}

interface Suggestion {
  tier: Tier;
  school: string;
  major: string;
  min_rank: number;
  min_score?: number;
  gap: number;
  gap_ratio: number;
  confidence: string;
  reason: string;
  risk: string;
  // 保研率+薪资补充数据
  baoyan_rate?: number | null;
  avg_salary?: number | null;
  salary_3y?: number | null;
  salary_5y?: number | null;
  employment_rate?: number | null;
  top_employers?: string[];
  school_province?: string | null;
}

interface DecisionTreeQuestion {
  id: string;
  title: string;
  description: string;
  type: "single" | "multi";
  options: Array<{ value: string; label: string; description: string }>;
}

interface DecisionTreeConfig {
  questions: DecisionTreeQuestion[];
}

interface FilterSelections {
  [key: string]: string | string[];
}

const TIER_COLORS: Record<Tier, string> = {
  "冲": "bg-red-50 border-red-200 text-red-700",
  "小冲": "bg-orange-50 border-orange-200 text-orange-700",
  "稳": "bg-green-50 border-green-200 text-green-700",
  "保": "bg-blue-50 border-blue-200 text-blue-700",
  "垫": "bg-slate-50 border-slate-200 text-slate-600",
};

const TIER_ICONS: Record<Tier, string> = {
  "冲": "🔥",
  "小冲": "⚡",
  "稳": "✅",
  "保": "🛡️",
  "垫": "🏠",
};

function PlannerContent() {
  const router = useRouter();
  const params = useSearchParams();
  const province = params.get("province") || "";
  const score = params.get("score") || "";
  const rank = params.get("rank") || "";
  const track = params.get("track") || "";
  const year = params.get("year") || "2026";

  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [conversions, setConversions] = useState<ConversionResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // 决策树状态
  const [treeConfig, setTreeConfig] = useState<DecisionTreeConfig | null>(null);
  const [filters, setFilters] = useState<FilterSelections>({});
  const [filterActive, setFilterActive] = useState(false);
  const [filtering, setFiltering] = useState(false);

  // 科类英文→中文映射
  const trackNameMap: Record<string, string> = {
    physics: "物理类", history: "历史类",
    science: "理科", arts: "文科", comprehensive: "综合",
  };
  const trackCN = trackNameMap[track] || track;

  // 加载决策树配置
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/decision-tree");
        if (res.ok) {
          const data = await res.json();
          setTreeConfig(data);
        }
      } catch {
        // silent
      }
    }
    loadConfig();
  }, []);

  // 获取初始推荐
  const fetchInitialPlan = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, convertRes] = await Promise.all([
        fetch(`/api/plan?province=${province}&rank=${rank}&track=${trackCN}&year=${year}`),
        fetch(`/api/convert-rank?province=${province}&track=${trackCN}&rank=${rank}&year=${year}`),
      ]);
      const planData = await planRes.json();
      setSuggestions(planData.suggestions || []);
      setTotalCount(planData.total || 0);

      if (convertRes.ok) {
        const convertData = await convertRes.json();
        setConversions(convertData.equivalent || []);
      }
    } catch {
      setSuggestions(getDemoSuggestions());
      setTotalCount(7);
    } finally {
      setLoading(false);
    }
  }, [province, rank, trackCN, year]);

  useEffect(() => {
    fetchInitialPlan();
  }, [fetchInitialPlan]);

  // 应用决策树过滤
  const applyFilter = useCallback(async () => {
    if (Object.keys(filters).length === 0) {
      setFilterActive(false);
      fetchInitialPlan();
      return;
    }
    setFiltering(true);
    setFilterActive(true);
    try {
      const res = await fetch("/api/decision-tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          province, rank: parseInt(rank), track: trackCN, year,
          options: filters,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setTotalCount(data.total || 0);
      }
    } catch {
      // keep current suggestions
    } finally {
      setFiltering(false);
    }
  }, [filters, province, rank, trackCN, year, fetchInitialPlan]);

  useEffect(() => {
    if (Object.keys(filters).length > 0) {
      applyFilter();
    }
  }, [filters, applyFilter]);

  // 处理单选/多选变更
  const handleFilterChange = (questionId: string, value: string, isMulti: boolean) => {
    setFilters((prev) => {
      const current = prev[questionId];
      if (isMulti) {
        const arr = Array.isArray(current) ? [...current] : [];
        const idx = arr.indexOf(value);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(value);
        return { ...prev, [questionId]: arr };
      } else {
        return { ...prev, [questionId]: prev[questionId] === value ? "" : value };
      }
    });
  };

  // 清除所有筛选
  const clearFilters = () => {
    setFilters({});
    setFilterActive(false);
    fetchInitialPlan();
  };

  // 统计有效筛选数
  const activeFilterCount = Object.values(filters).filter(
    (v) => (Array.isArray(v) && v.length > 0) || (typeof v === "string" && v !== "")
  ).length;

  const grouped = suggestions.reduce((acc, s) => {
    (acc[s.tier] = acc[s.tier] || []).push(s);
    return acc;
  }, {} as Record<Tier, Suggestion[]>);

  const tierOrder: Tier[] = ["冲", "小冲", "稳", "保", "垫"];

  const getSelectedLabel = (q: DecisionTreeQuestion, val: string) => {
    return q.options.find((o) => o.value === val)?.label || val;
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* 返回按钮 */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-sky-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          ← 返回修改
        </button>
        <a
          href="/"
          className="text-sm text-slate-500 hover:text-sky-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          重新填写成绩
        </a>
      </div>

      {/* 考生画像 */}
      <div className="bg-gradient-to-r from-sky-700 to-blue-900 text-white rounded-2xl p-8 mb-8">
        <h1 className="text-2xl font-bold mb-3">🎯 你的专属志愿方案</h1>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div><span className="text-sky-200">省份</span><p className="font-semibold">{province}</p></div>
          <div><span className="text-sky-200">年份</span><p className="font-semibold">{year}</p></div>
          <div><span className="text-sky-200">分数</span><p className="font-semibold">{score}</p></div>
          <div><span className="text-sky-200">位次</span><p className="font-semibold">{rank}</p></div>
          <div><span className="text-sky-200">科类</span><p className="font-semibold">{track}</p></div>
        </div>

        {/* 等效分数换算 */}
        {conversions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-sky-500/30">
            <p className="text-sm text-sky-200 mb-2">📐 位次等效分数换算</p>
            <div className="flex flex-wrap gap-3">
              {conversions.map((cv) => (
                <div key={cv.year} className="bg-white/15 rounded-lg px-4 py-2 text-center">
                  <span className="text-xs text-sky-200">{cv.year}年</span>
                  <p className="text-xl font-bold">
                    {cv.equivalent_score !== null ? `${cv.equivalent_score}分` : "—"}
                  </p>
                  <span className="text-xs text-sky-200/70">
                    {rank}位次 ≈ {cv.equivalent_score !== null ? `${cv.equivalent_score}分` : "暂无数据"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 决策树筛选区 */}
      {treeConfig && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              🎯 报考偏好筛选
              {activeFilterCount > 0 && (
                <span className="ml-2 text-sm font-normal text-sky-600">
                  ({activeFilterCount} 项筛选已激活)
                </span>
              )}
            </h2>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-sm text-slate-500 hover:text-red-600 px-3 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                清除筛选
              </button>
            )}
          </div>

          {/* 已选标签 */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-slate-100">
              {treeConfig.questions.map((q) => {
                const val = filters[q.id];
                if (!val) return null;
                if (Array.isArray(val)) {
                  return val.map((v) => (
                    <span key={`${q.id}-${v}`} className="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full">
                      {q.title}: {getSelectedLabel(q, v)}
                      <button
                        onClick={() => handleFilterChange(q.id, v, true)}
                        className="ml-1 hover:text-red-500 cursor-pointer"
                      >
                        ✕
                      </button>
                    </span>
                  ));
                }
                return (
                  <span className="inline-flex items-center gap-1 text-xs bg-sky-100 text-sky-700 px-2.5 py-1 rounded-full">
                    {q.title}: {getSelectedLabel(q, val)}
                    <button
                      onClick={() => handleFilterChange(q.id, val, false)}
                      className="ml-1 hover:text-red-500 cursor-pointer"
                    >
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* 问题列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {treeConfig.questions.map((q) => {
              const currentVal = filters[q.id];
              const isMulti = q.type === "multi";
              return (
                <div key={q.id} className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-sm font-medium text-slate-700 mb-1">{q.title}</p>
                  <p className="text-xs text-slate-400 mb-2">{q.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((opt) => {
                      const selected = isMulti
                        ? Array.isArray(currentVal) && currentVal.includes(opt.value)
                        : currentVal === opt.value;
                      return (
                        <div key={opt.value} className="relative group">
                          <button
                            onClick={() => handleFilterChange(q.id, opt.value, isMulti)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                              selected
                                ? "bg-sky-600 text-white border-sky-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                            }`}
                          >
                            {opt.label}
                          </button>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-10 pointer-events-none">
                            {opt.description}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading || filtering ? (
        <div className="text-center py-20 text-slate-400">
          <div className="text-4xl mb-4 animate-pulse">⏳</div>
          <p>{filtering ? "正在过滤推荐方案..." : "正在分析数据，生成志愿方案..."}</p>
        </div>
      ) : (
        <>
          {/* 结果统计 */}
          <div className="text-sm text-slate-500 mb-4">
            共 {totalCount} 个推荐
            {filterActive && suggestions.length !== totalCount && (
              <span className="ml-2">（筛选后 {suggestions.length} 个）</span>
            )}
          </div>

          {/* 推荐列表 */}
          <div className="space-y-6">
            {tierOrder.map((tier) => {
              const items = grouped[tier] || [];
              if (items.length === 0) return null;
              return (
                <div key={tier}>
                  <h2 className="text-lg font-semibold text-slate-800 mb-3">
                    {TIER_ICONS[tier]} {tier}志愿{" "}
                    <span className="text-sm font-normal text-slate-400">({items.length}个)</span>
                  </h2>
                  <div className="space-y-3">
                    {items.map((item, i) => (
                      <div key={i} className={`rounded-xl border p-4 ${TIER_COLORS[item.tier]}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-semibold text-base">{item.school}</span>
                            <span className="text-sm ml-2 opacity-75">{item.major}</span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/60">
                            历史最低位次 {item.min_rank.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm space-y-1.5 opacity-80">
                          <p>位次差：{item.gap > 0 ? `+${item.gap.toLocaleString()}` : item.gap.toLocaleString()} | 
                          置信度：{item.confidence}{item.school_province ? ` | ${item.school_province}` : ""}</p>
                          <p>💡 {item.reason}</p>
                          {/* 保研率+薪资 */}
                          <div className="flex flex-wrap gap-2 mt-1">
                            {item.baoyan_rate !== null && item.baoyan_rate !== undefined && (
                              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                                🎓 保研率 {item.baoyan_rate}%
                              </span>
                            )}
                            {item.avg_salary !== null && item.avg_salary !== undefined && (
                              <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                                💰 起薪 {Math.round(item.avg_salary / 1000)}K/月
                              </span>
                            )}
                            {item.employment_rate !== null && item.employment_rate !== undefined && (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                📊 就业率 {item.employment_rate}%
                              </span>
                            )}
                          </div>
                          {item.top_employers && item.top_employers.length > 0 && (
                            <p className="text-xs text-slate-400 mt-1">
                              🏢 主要去向：{item.top_employers.slice(0, 4).join("、")}
                            </p>
                          )}
                          <p className="text-xs text-amber-600/60 mt-0.5">⚠️ {item.risk}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 底部 */}
      <div className="mt-10 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <strong>⚠️ 提交前必核验</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside text-amber-700">
          <li>核对各省考试院官方《招生计划汇编》</li>
          <li>确认院校招生章程（体检/单科/语种限制）</li>
          <li>核实院校代码与专业组代码</li>
          <li>校验选科要求与选考科目匹配</li>
          <li>确认学费、校区、调剂政策</li>
        </ul>
      </div>
    </div>
  );
}

function getDemoSuggestions(): Suggestion[] {
  return [
    { tier: "冲", school: "郑州大学", major: "计算机科学与技术", min_rank: 28000, gap: -7241, gap_ratio: -0.205, confidence: "中", reason: "学科评估B+，与分数区间有重叠", risk: "热门专业，计划可能缩减", baoyan_rate: 18, avg_salary: 9500, employment_rate: 90, top_employers: ["华为", "宇通", "郑大一附院"], school_province: "河南" },
    { tier: "冲", school: "河南大学", major: "软件工程", min_rank: 31000, gap: -4241, gap_ratio: -0.120, confidence: "中", reason: "省属重点，专业实力强", risk: "组内有冷门专业调剂风险", baoyan_rate: 14, avg_salary: 8500, employment_rate: 88, school_province: "河南" },
    { tier: "小冲", school: "河南科技大学", major: "自动化", min_rank: 34000, gap: -1241, gap_ratio: -0.035, confidence: "中高", reason: "位次接近，录取概率较大", risk: "专业热度上升", baoyan_rate: 6, avg_salary: 7500, school_province: "河南" },
    { tier: "稳", school: "河南理工大学", major: "电子信息工程", min_rank: 36000, gap: 1241, gap_ratio: 0.035, confidence: "高", reason: "近三年位次稳定，位次优于历史线", risk: "计划数持平", baoyan_rate: 5, avg_salary: 7200, school_province: "河南" },
    { tier: "稳", school: "华北水利水电大学", major: "电气工程及其自动化", min_rank: 37000, gap: 2241, gap_ratio: 0.064, confidence: "高", reason: "行业特色院校，就业稳定", risk: "工科专业竞争度中等", baoyan_rate: 4, avg_salary: 7000, school_province: "河南" },
    { tier: "保", school: "中原工学院", major: "机械设计制造及其自动化", min_rank: 44000, gap: 7241, gap_ratio: 0.205, confidence: "很高", reason: "位次远高于历史线，录取把握大", risk: "保底充足", baoyan_rate: 2, avg_salary: 6000 },
    { tier: "垫", school: "郑州轻工业大学", major: "食品科学与工程", min_rank: 52000, gap: 17241, gap_ratio: 0.489, confidence: "极高", reason: "绝对安全", risk: "最低保证", baoyan_rate: 2, avg_salary: 6200 },
  ];
}

export default function PlannerPage() {
  return (
    <Suspense fallback={<div className="text-center py-20">加载中...</div>}>
      <PlannerContent />
    </Suspense>
  );
}
