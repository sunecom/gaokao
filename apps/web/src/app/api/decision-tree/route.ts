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
  major_category?: string;
  tuition?: number;
  province?: string;
}

/**
 * 检查建议项是否匹配用户选择
 */
function matchesFilter(
  item: Suggestion,
  options: DecisionTreeOptions,
  userProvince: string
): boolean {
  // 调剂偏好
  if (options.adjustment === "reject") {
    // 不接受调剂：只显示录取概率高的（稳/保/垫）
    if (["冲", "小冲"].includes(item.tier)) {
      return false;
    }
  }

  // 地点偏好
  if (options.location === "local" && item.province && item.province !== userProvince) {
    return false;
  }
  if (options.location === "outside" && item.province && item.province === userProvince) {
    return false;
  }

  // 专业方向（多选）
  if (options.major_direction && options.major_direction.length > 0) {
    const selectedCategories = options.major_direction;
    const majorLower = item.major.toLowerCase();
    const categoryKeywords: Record<string, string[]> = {
      engineering: ["计算机", "电子", "机械", "土木", "自动化", "电气", "软件"],
      science: ["数学", "物理", "化学", "生物"],
      medicine: ["临床", "口腔", "药学", "医学"],
      business: ["经济", "金融", "会计", "管理", "工商"],
      arts: ["中文", "历史", "哲学", "外语", "英语"],
      law: ["法学", "政治"],
      education: ["教育", "心理"],
      agriculture: ["农学", "林学", "园艺"],
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
      return true;
    }

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
    const scored = schools.map((item: any) => {
      const minRank = item.min_rank || 99999;
      const gap = minRank - rank;
      const gapRatio = gap / rank;

      let tier = "垫";
      if (gapRatio < -0.05) tier = "冲";
      else if (gapRatio < 0.03) tier = "小冲";
      else if (gapRatio < 0.15) tier = "稳";
      else if (gapRatio < 0.35) tier = "保";

      const confidence =
        gapRatio < -0.05 ? "低" : gapRatio < 0.03 ? "中" : gapRatio < 0.15 ? "高" : "很高";

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
        major_category: item.major_category || "",
        tuition: item.tuition || 0,
        province: item.province || province,
      } as Suggestion;
    });

    // 应用决策树过滤
    const filtered = scored.filter((item) => matchesFilter(item, options || {}, province));

    // 按 tier 排序
    const tierOrder: Record<string, number> = { "冲": 0, "小冲": 1, "稳": 2, "保": 3, "垫": 4 };
    filtered.sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99));

    return NextResponse.json({
      suggestions: filtered.slice(0, 30),
      total: filtered.length,
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