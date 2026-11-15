import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface DecisionTreeOptions {
  adjustment?: "accept" | "reject";
  location?: "local" | "outside" | "any";
  major_direction?: string[];
  school_level?: string[];
  school_type?: string[];
  location_preference?: string[];
  tier_strategy?: "aggressive" | "balanced" | "conservative" | "safe";
  tuition_budget?: "low" | "medium" | "high" | "no_limit";
}

interface Suggestion {
  tier: string;
  school: string;
  major: string;
  min_rank: number;
  gap: number;
  gap_ratio: number;
  school_type?: string;
  school_tags?: string[];
  school_category?: string;
  school_province?: string;
  tuition?: number;
}

// 专业方向关键词
const MAJOR_KEYWORDS: Record<string, string[]> = {
  engineering: ["计算机", "电子", "机械", "土木", "自动化", "电气", "软件", "工程"],
  science: ["数学", "物理", "化学", "生物", "统计"],
  medicine: ["临床", "口腔", "药学", "医学", "护理", "中医"],
  business: ["经济", "金融", "会计", "管理", "工商", "财务", "市场"],
  arts: ["中文", "历史", "哲学", "外语", "英语", "文学"],
  law: ["法学", "政治", "社会学"],
  education: ["教育", "心理", "学前"],
  agriculture: ["农学", "林学", "园艺", "畜牧", "兽医"],
  art_design: ["设计", "音乐", "美术", "传媒", "艺术", "动画"],
};

// 地域映射
const CITY_MAP: Record<string, string[]> = {
  beijing: ["北京"],
  shanghai: ["上海"],
  jiangzhehu: ["江苏", "浙江", "上海"],
  guangdong: ["广东"],
  wuhan: ["湖北"],
  nanjing: ["江苏"],
  xian: ["陕西"],
  chengdu: ["四川", "重庆"],
  dongbei: ["辽宁", "吉林", "黑龙江"],
};

function matchesFilter(item: Suggestion, options: DecisionTreeOptions, userProvince: string): boolean {
  // 地域偏好
  if (options.location_preference && options.location_preference.length > 0) {
    const prefs = options.location_preference;
    if (!prefs.includes("no_preference")) {
      const sp = item.school_province || "";
      let match = false;
      for (const pref of prefs) {
        if (pref === "local" && sp === userProvince) { match = true; break; }
        const provinces = CITY_MAP[pref] || [];
        if (provinces.includes(sp)) { match = true; break; }
      }
      if (!match) return false;
    }
  }

  // 专业方向
  if (options.major_direction && options.major_direction.length > 0) {
    const majorLower = item.major.toLowerCase();
    const has = options.major_direction.some((cat) => {
      const kws = MAJOR_KEYWORDS[cat] || [];
      return kws.some((kw) => majorLower.includes(kw));
    });
    if (!has) return false;
  }

  // 院校层次
  if (options.school_level && options.school_level.length > 0) {
    const tags = item.school_tags || [];
    const type = item.school_type || "";
    if (tags.length > 0 || type) {
      const has = options.school_level.some((level) => {
        if (level === "985") return tags.includes("985");
        if (level === "211") return tags.includes("211") || tags.includes("985");
        if (level === "double_first") return tags.includes("985") || tags.includes("211") || tags.includes("double_first");
        if (level === "provincial") return type === "provincial_key" || type === "公办";
        if (level === "private") return type === "private" || type === "民办";
        return true;
      });
      if (!has) return false;
    }
  }

  // 院校类型
  if (options.school_type && options.school_type.length > 0) {
    const category = item.school_category || "";
    if (category) {
      const has = options.school_type.some((t) => {
        if (t === "comprehensive") return category.includes("综合");
        if (t === "science_engineering") return category.includes("理工") || category.includes("工科");
        if (t === "normal") return category.includes("师范");
        if (t === "medical") return category.includes("医药") || category.includes("医学");
        if (t === "finance_economics") return category.includes("财经") || category.includes("经济");
        if (t === "politics_law") return category.includes("政法");
        if (t === "agriculture") return category.includes("农林");
        if (t === "language") return category.includes("语言") || category.includes("外语");
        if (t === "military_police") return category.includes("军警");
        return true;
      });
      if (!has) return false;
    }
  }

  // 学费预算
  if (options.tuition_budget && item.tuition) {
    const maxMap: Record<string, number> = { low: 5000, medium: 15000, high: 999999, no_limit: 999999 };
    if (item.tuition > (maxMap[options.tuition_budget] || 999999)) return false;
  }

  return true;
}

function applyTierStrategy(
  items: Suggestion[],
  strategy?: string,
  adjustment?: string
): Suggestion[] {
  if (!strategy) return items;

  const ratios: Record<string, Record<string, Record<string, number>>> = {
    aggressive: {
      accept: { "冲": 0.4, "小冲": 0.3, "稳": 0.2, "保": 0.08, "垫": 0.02 },
      reject: { "冲": 0.1, "小冲": 0.15, "稳": 0.35, "保": 0.3, "垫": 0.1 },
    },
    balanced: {
      accept: { "冲": 0.2, "小冲": 0.2, "稳": 0.3, "保": 0.2, "垫": 0.1 },
      reject: { "冲": 0.05, "小冲": 0.1, "稳": 0.4, "保": 0.3, "垫": 0.15 },
    },
    conservative: {
      accept: { "冲": 0.1, "小冲": 0.15, "稳": 0.35, "保": 0.3, "垫": 0.1 },
      reject: { "冲": 0.02, "小冲": 0.08, "稳": 0.4, "保": 0.35, "垫": 0.15 },
    },
    safe: {
      accept: { "冲": 0.05, "小冲": 0.1, "稳": 0.3, "保": 0.35, "垫": 0.2 },
      reject: { "冲": 0.01, "小冲": 0.04, "稳": 0.35, "保": 0.4, "垫": 0.2 },
    },
  };

  const adj = adjustment || "accept";
  const r = ratios[strategy]?.[adj];
  if (!r) return items;

  const grouped: Record<string, Suggestion[]> = {};
  for (const item of items) {
    (grouped[item.tier] = grouped[item.tier] || []).push(item);
  }
  for (const t of Object.keys(grouped)) {
    grouped[t].sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));
  }

  const result: Suggestion[] = [];
  for (const [tier, ratio] of Object.entries(r)) {
    const count = Math.round(100 * ratio);
    result.push(...(grouped[tier] || []).slice(0, count));
  }
  return result;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const province = searchParams.get("province") || "";
  const rankStr = searchParams.get("rank");
  const rank = rankStr ? parseInt(rankStr) : 0;
  const year = searchParams.get("year") || "2026";
  const optionsJson = searchParams.get("options") || "";
  const selectedJson = searchParams.get("selected") || "";

  if (!province || !rank) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

  let options: DecisionTreeOptions = {};
  try {
    if (optionsJson) options = JSON.parse(decodeURIComponent(optionsJson));
  } catch {}

  let selectedKeys: Set<string> | null = null;
  try {
    if (selectedJson) {
      const arr = JSON.parse(decodeURIComponent(selectedJson));
      if (Array.isArray(arr) && arr.length > 0) {
        selectedKeys = new Set(arr);
      }
    }
  } catch {}

  // 加载数据
  const filePath = path.join(process.cwd(), "data", `schools_${province}.json`);
  let schools: any[] = [];
  try {
    schools = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return NextResponse.json({ error: "数据不可用" }, { status: 500 });
  }

  // 补充数据
  let extraData: Record<string, any> = {};
  try {
    const extraPath = path.join(process.cwd(), "data", "school_extra.json");
    const extraList = JSON.parse(fs.readFileSync(extraPath, "utf-8"));
    for (const item of extraList) extraData[item.name] = item;
  } catch {}

  // 计算梯度（排除差距>20%）
  const scored: Suggestion[] = schools
    .filter((item: any) => {
      const minRank = item.min_rank || 99999;
      return (minRank - rank) / rank >= -0.20;
    })
    .map((item: any) => {
      const minRank = item.min_rank || 99999;
      const gap = minRank - rank;
      const gapRatio = gap / rank;

      let tier = "垫";
      if (gapRatio < -0.05) tier = "冲";
      else if (gapRatio < 0.03) tier = "小冲";
      else if (gapRatio < 0.15) tier = "稳";
      else if (gapRatio < 0.35) tier = "保";

      const extra = extraData[item.school_name];

      return {
        tier,
        school: item.school_name,
        major: item.major_name,
        min_rank: minRank,
        gap,
        gap_ratio: Math.round(gapRatio * 1000) / 1000,
        school_type: item.school_type,
        school_tags: item.school_tags || [],
        school_category: item.school_category || "",
        school_province: item.school_province || extra?.province || "",
        tuition: item.tuition || 0,
      };
    });

  // 应用筛选
  const filtered = scored.filter((item) => matchesFilter(item, options, province));

  // 应用策略
  const strategized = applyTierStrategy(filtered, options.tier_strategy, options.adjustment);

  // 排序
  const tierOrder: Record<string, number> = { "冲": 0, "小冲": 1, "稳": 2, "保": 3, "垫": 4 };
  strategized.sort((a, b) => {
    const d = (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99);
    if (d !== 0) return d;
    return Math.abs(a.gap) - Math.abs(b.gap);
  });

  // 如果传了 selected，只导出选中的条目
  let finalList = strategized;
  if (selectedKeys) {
    finalList = strategized.filter((s) => {
      const key = `${s.tier}|${s.school}|${s.major}`;
      return selectedKeys!.has(key);
    });
  }

  // 生成 CSV
  const header = "梯度,学校,专业,历史最低位次,位次差,位次差%,院校省份,保研率,起薪(元/月),就业率";
  const csvRows = [
    header,
    ...finalList.map((s) => {
      const extra = extraData[s.school] || {};
      return [
        `"${s.tier}"`,
        `"${s.school}"`,
        `"${s.major}"`,
        s.min_rank,
        s.gap,
        `"${(s.gap_ratio * 100).toFixed(1)}%"`,
        `"${s.school_province}"`,
        extra.baoyan_rate ? `"${extra.baoyan_rate}%"` : "",
        extra.avg_salary || "",
        extra.employment_rate ? `"${extra.employment_rate}%"` : "",
      ].join(",");
    }),
  ];

  const bom = "\uFEFF";
  const csvContent = bom + csvRows.join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`志愿方案_${province}_${year}_位次${rank}.csv`)}`,
    },
  });
}
