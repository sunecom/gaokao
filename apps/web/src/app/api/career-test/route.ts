import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface CareerTestConfig {
  title: string;
  description: string;
  questions: Question[];
  career_mapping: Career[];
}

interface Question {
  id: string;
  text: string;
  options: Array<{
    value: string;
    label: string;
    traits: string[];
  }>;
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

interface CareerResult {
  career: Career;
  score: number;
  matched_traits: string[];
  total_traits: number;
}

function loadConfig(): CareerTestConfig | null {
  const configPath = path.join(process.cwd(), "data", "career_test.json");
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * 计算用户性格与职业的匹配度
 */
function calculateMatches(userTraits: string[], careers: Career[]): CareerResult[] {
  const traitSet = new Set(userTraits.map((t) => t.toLowerCase()));
  const results: CareerResult[] = [];

  for (const career of careers) {
    const requiredTraits = career.match_traits;
    const matched = requiredTraits.filter((t) => traitSet.has(t.toLowerCase()));
    const score = Math.round((matched.length / Math.max(requiredTraits.length, 1)) * 100);

    if (score >= 30) {
      results.push({
        career,
        score,
        matched_traits: matched,
        total_traits: requiredTraits.length,
      });
    }
  }

  // 按匹配度降序排列
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}

/**
 * GET /api/career-test
 * 返回测试配置（问题列表）
 */
export async function GET() {
  const config = loadConfig();
  if (!config) {
    return NextResponse.json({ error: "配置加载失败" }, { status: 500 });
  }
  return NextResponse.json({
    title: config.title,
    description: config.description,
    questions: config.questions,
  });
}

/**
 * POST /api/career-test
 * Body: { answers: { q1: "tech", q2: "analyze", ... } }
 * 返回匹配的职业推荐
 */
export async function POST(request: NextRequest) {
  try {
    const config = loadConfig();
    if (!config) {
      return NextResponse.json({ error: "配置加载失败" }, { status: 500 });
    }

    const body = await request.json();
    const { answers } = body;

    if (!answers || Object.keys(answers).length < 3) {
      return NextResponse.json(
        { error: "请至少回答 3 道题" },
        { status: 400 }
      );
    }

    // 收集用户所有的性格标签
    const userTraits: string[] = [];
    const answerDetails: Array<{ questionId: string; questionText: string; answerLabel: string }> = [];

    for (const [questionId, answerValue] of Object.entries(answers)) {
      const question = config.questions.find((q) => q.id === questionId);
      if (!question) continue;

      const option = question.options.find((o) => o.value === answerValue);
      if (!option) continue;

      userTraits.push(...option.traits);
      answerDetails.push({
        questionId,
        questionText: question.text,
        answerLabel: option.label,
      });
    }

    // 去重
    const uniqueTraits = [...new Set(userTraits)];

    // 计算匹配
    const matches = calculateMatches(uniqueTraits, config.career_mapping);

    // 性格画像摘要
    const traitGroups: Record<string, string[]> = {
      "技术型": ["技术型", "逻辑型", "分析型", "数理型", "严谨型", "钻研型", "工程型", "专注型", "精准型"],
      "创意型": ["艺术型", "创新型", "创意型", "感性型", "自由型"],
      "社交型": ["社交型", "服务型", "沟通型", "协调型", "外向型", "合作型"],
      "管理型": ["企业型", "管理型", "领导型", "决策型", "商业型", "开拓型", "进取型"],
      "稳健型": ["稳健型", "可靠型", "保守型", "平衡型", "责任型", "安定型"],
    };

    const personalitySummary = Object.entries(traitGroups)
      .filter(([, traits]) => traits.some((t) => uniqueTraits.includes(t)))
      .map(([group]) => group);

    return NextResponse.json({
      traits: uniqueTraits,
      personality_summary: personalitySummary,
      matches,
      answer_details: answerDetails,
      disclaimer: "本测评仅供参考，最终职业选择请结合个人实际情况综合判断。",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "服务器错误", detail: String(error) },
      { status: 500 }
    );
  }
}
