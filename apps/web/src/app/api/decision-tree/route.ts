import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * 决策树问题选项
 */
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

/**
 * 建议项（与 /api/plan 返回格式一致）
 */
interface Suggestion {
  tier: string;
  school: string;
  major: string;
  min_rank: number;
  gap: number;
  gap_ratio: number;
  confidence: string;
  reason: string;
  risk: string;
  // 额外字段（用于过滤）
  school_type?: string;
  school_tags?: string[];
  school_category?: string;
  major_category?: string;
  tuition?: number;
  province?: string;  // 考生省份（保留兼容）
  school_province?: string;  // 院校所在省份
}

/**
 * 检查建议项是否匹配用户选择
 */
function matchesFilter(
  item: Suggestion,
  options: DecisionTreeOptions,
  userProvince: string
): boolean {
  // 调剂偏好（不再直接排除冲，而是调整策略）
  // 不接受调剂时，冲的比例降低，稳保垫比例提高
  // 这个逻辑在 applyTierStrategy 中处理

  // 地点偏好（旧版兼容）
  if (options.location === "local" && item.province && item.province !== userProvince) {
    return false;
  }
  if (options.location === "outside" && item.province && item.province === userProvince) {
    return false;
  }

  // 地域偏好（新版多选）
  if (options.location_preference && options.location_preference.length > 0) {
    const prefs = options.location_preference;
    
    // 如果选了"不限地域"，跳过筛选
    if (!prefs.includes("no_preference")) {
      // 使用院校所在省份进行筛选
      const schoolProvince = item.school_province || "";
      let match = false;
      
      for (const pref of prefs) {
        if (pref === "local" && schoolProvince === userProvince) {
          match = true;
          break;
        }
        // 城市/地区映射
        const cityMap: Record<string, string[]> = {
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
        
        const provinces = cityMap[pref] || [];
        if (provinces.includes(schoolProvince)) {
          match = true;
          break;
        }
      }
      
      if (!match) {
        return false;
      }
    }
  }

  // 专业方向（多选）
  if (options.major_direction && options.major_direction.length > 0) {
    const selectedCategories = options.major_direction;
    const majorLower = item.major.toLowerCase();
    const categoryKeywords: Record<string, string[]> = {
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

    const hasMatchingCategory = selectedCategories.some((cat) => {
      const keywords = categoryKeywords[cat] || [];
      return keywords.some((kw) => majorLower.includes(kw));
    });

    if (!hasMatchingCategory) {
      return false;
    }
  }

  // 院校层次（多选）
  if (options.school_level && options.school_level.length > 0) {
    const selectedLevels = options.school_level;
    const tags = item.school_tags || [];
    const type = item.school_type || "";

    // 数据无标签时跳过此筛选（避免误杀全部结果）
    if (tags.length === 0 && !type) {
      // 继续
    } else {
      const hasMatchingLevel = selectedLevels.some((level) => {
        if (level === "985") return tags.includes("985");
        if (level === "211") return tags.includes("211") || tags.includes("985");
        if (level === "double_first") return tags.includes("985") || tags.includes("211") || tags.includes("double_first");
        if (level === "provincial") return type === "provincial_key" || type === "公办";
        if (level === "private") return type === "private" || type === "民办";
        return true;
      });

      if (!hasMatchingLevel) {
        return false;
      }
    }
  }

  // 院校类型（多选）
  if (options.school_type && options.school_type.length > 0) {
    const selectedTypes = options.school_type;
    const category = item.school_category || "";
    
    // 数据无类型时跳过此筛选
    if (!category) {
      // 继续
    } else {
      const hasMatchingType = selectedTypes.some((t) => {
        if (t === "comprehensive") return category.includes("综合");
        if (t === "science_engineering") return category.includes("理工") || category.includes("工科");
        if (t === "normal") return category.includes("师范");
        if (t === "medical") return category.includes("医药") || category.includes("医学");
        if (t === "finance_economics") return category.includes("财经") || category.includes("经济");
        if (t === "politics_law") return category.includes("政法");
        if (t === "agriculture") return category.includes("农林");
        if (t === "language") return category.includes("语言") || category.includes("外语");
        return true;
      });

      if (!hasMatchingType) {
        return false;
      }
    }
  }

  // 学费预算
  if (options.tuition_budget && item.tuition) {
    const maxTuitionMap: Record<string, number> = {
      low: 5000,
      medium: 15000,
      high: 999999,
      no_limit: 999999,
    };
    const maxTuition = maxTuitionMap[options.tuition_budget] || 999999;
    if (item.tuition > maxTuition) {
      return false;
    }
  }

  return true;
}

/**
 * 根据冲稳保策略筛选
 */
function applyTierStrategy(
  items: Suggestion[],
  strategy?: "aggressive" | "balanced" | "conservative" | "safe",
  adjustment?: "accept" | "reject"
): Suggestion[] {
  if (!strategy) return items;

  // 策略比例：冲/小冲/稳/保/垫
  // 不接受调剂时，冲的比例降低，稳保垫比例提高
  const strategyRatios: Record<string, Record<string, Record<string, number>>> = {
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
  const ratios = strategyRatios[strategy]?.[adj];
  if (!ratios) return items;

  // 按 tier 分组
  const grouped: Record<string, Suggestion[]> = {};
  for (const item of items) {
    if (!grouped[item.tier]) grouped[item.tier] = [];
    grouped[item.tier].push(item);
  }

  // 计算每个 tier 应该保留的数量（基于总数 100）
  const totalCount = 100;
  const result: Suggestion[] = [];

  for (const [tier, ratio] of Object.entries(ratios)) {
    const count = Math.round(totalCount * ratio);
    const tierItems = grouped[tier] || [];
    result.push(...tierItems.slice(0, count));
  }

  return result;
}

/**
 * POST /api/decision-tree
 * Body: { province, rank, track, year, options: DecisionTreeOptions }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { province, rank, track, year, options } = body;

    if (!province || !rank) {
      return NextResponse.json({ error: "请提供省份和位次" }, { status: 400 });
    }

    // 加载原始推荐数据（复用 /api/plan 的逻辑）
    const filePath = path.join(process.cwd(), "data", `schools_${province}.json`);
    let schools: any[] = [];
    try {
      schools = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return NextResponse.json({ error: "该省份数据暂不可用" }, { status: 404 });
    }

    // 计算每个学校的风险等级
    const scored = schools
      .filter((item: any) => {
        const minRank = item.min_rank || 99999;
        const gapRatio = (minRank - rank) / rank;
        return gapRatio >= -0.20; // 排除差距太大的
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

      const confidence =
        gapRatio < -0.15 ? "极低" : gapRatio < -0.05 ? "低" : gapRatio < 0.03 ? "中" : gapRatio < 0.15 ? "高" : "很高";

      return {
        tier,
        school: item.school_name,
        major: item.major_name,
        min_rank: minRank,
        gap,
        gap_ratio: Math.round(gapRatio * 1000) / 1000,
        confidence,
        reason: item.school_type
          ? `${item.school_type}院校`
          : item.subject_require
            ? `选考科目：${item.subject_require}`
            : "位次匹配推荐",
        risk: "请核对招生章程和计划变化",
        school_type: item.school_type,
        school_tags: item.school_tags || [],
        school_province: item.school_province || "",
        major_category: item.major_category || "",
        tuition: item.tuition || 0,
        province: item.province || province,
      } as Suggestion;
    });

    // 应用决策树过滤
    const filtered = scored.filter((item) => matchesFilter(item, options || {}, province));

    // 应用冲稳保策略
    const strategized = applyTierStrategy(filtered, options?.tier_strategy, options?.adjustment);

    // 按 tier 排序，同 tier 内按位次接近度排序
    const tierOrder: Record<string, number> = { "冲": 0, "小冲": 1, "稳": 2, "保": 3, "垫": 4 };
    strategized.sort((a, b) => {
      const tierDiff = (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99);
      if (tierDiff !== 0) return tierDiff;
      return Math.abs(a.gap) - Math.abs(b.gap);
    });

    return NextResponse.json({
      suggestions: strategized.slice(0, 100),
      total: strategized.length,
      original_total: scored.length,
      profile: { province, rank, track, year },
      filter_applied: Object.keys(options || {}).length > 0,
    });
  } catch (error) {
    return NextResponse.json({ error: "服务器错误", detail: String(error) }, { status: 500 });
  }
}

/**
 * GET /api/decision-tree/config
 * 返回决策树配置（问题列表）
 */
export async function GET() {
  const configPath = path.join(process.cwd(), "data", "decision_tree.json");
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "配置加载失败" }, { status: 500 });
  }
}