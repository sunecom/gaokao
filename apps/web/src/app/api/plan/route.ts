import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// 退档风险检查器
interface RetireRiskCheck {
  has_vision_issue?: boolean;
  has_height_issue?: boolean;
  has_single_subject_issue?: boolean;
  needs_political_review?: boolean;
  warnings: string[];
}

function checkRetireRisk(
  schoolName: string,
  majorName: string,
  studentProfile: {
    vision_normal?: boolean;
    height_cm?: number;
    gender?: 'male' | 'female';
    single_subjects?: string[];
    political_review_passed?: boolean;
  }
): RetireRiskCheck {
  const restrictionsPath = path.join(process.cwd(), "data", "major_restrictions.json");
  let restrictions: any[] = [];
  try {
    restrictions = JSON.parse(fs.readFileSync(restrictionsPath, "utf-8"));
  } catch {
    return { warnings: [] };
  }

  const schoolRestriction = restrictions.find(r => r.school_name === schoolName);
  if (!schoolRestriction) {
    return { warnings: [] };
  }

  const warnings: string[] = [];
  const result: RetireRiskCheck = { warnings };

  // 检查专业限制（支持"所有专业"通配）
  const majorRestriction = schoolRestriction.major_restrictions[majorName] || 
                           schoolRestriction.major_restrictions["所有专业"];
  
  if (!majorRestriction) {
    return { warnings: [] };
  }

  // 视力检查
  if (majorRestriction.vision && studentProfile.vision_normal === false) {
    result.has_vision_issue = true;
    warnings.push(`⚠️ ${schoolName} - ${majorName}：要求${majorRestriction.vision}，考生色盲/色弱可能退档`);
  }

  // 身高检查
  if (majorRestriction.height && studentProfile.height_cm) {
    const heightReq = majorRestriction.height;
    let minHeight = 0;
    
    if (heightReq.includes('男≥')) {
      const match = heightReq.match(/男≥(\d+)cm/);
      if (match && studentProfile.gender === 'male') {
        minHeight = parseInt(match[1]);
      }
    }
    if (heightReq.includes('女≥')) {
      const match = heightReq.match(/女≥(\d+)cm/);
      if (match && studentProfile.gender === 'female') {
        minHeight = parseInt(match[1]);
      }
    }
    // 通用身高要求
    const genericMatch = heightReq.match(/≥(\d+)cm/);
    if (genericMatch && !minHeight) {
      minHeight = parseInt(genericMatch[1]);
    }

    if (minHeight > 0 && studentProfile.height_cm < minHeight) {
      result.has_height_issue = true;
      warnings.push(`⚠️ ${schoolName} - ${majorName}：要求身高≥${minHeight}cm，考生${studentProfile.height_cm}cm可能退档`);
    }
  }

  // 单科成绩检查
  if (majorRestriction.single_subject && studentProfile.single_subjects) {
    for (const req of majorRestriction.single_subject) {
      if (!studentProfile.single_subjects.includes(req)) {
        result.has_single_subject_issue = true;
        warnings.push(`⚠️ ${schoolName} - ${majorName}：要求选考${req}，考生未选考`);
      }
    }
  }

  // 政审检查
  if (majorRestriction.political_review && !studentProfile.political_review_passed) {
    result.needs_political_review = true;
    warnings.push(`⚠️ ${schoolName} - ${majorName}：军校/警校需通过政审和体检，请提前准备`);
  }

  return result;
}

// 位次风险分段
function tierFor(studentRank: number, minRank: number): { tier: string; gap: number; gapRatio: number } {
  const gap = minRank - studentRank;
  const gapRatio = gap / studentRank;
  if (gapRatio < -0.05) return { tier: "冲", gap, gapRatio };
  if (gapRatio < 0.03) return { tier: "小冲", gap, gapRatio };
  if (gapRatio < 0.15) return { tier: "稳", gap, gapRatio };
  if (gapRatio < 0.35) return { tier: "保", gap, gapRatio };
  return { tier: "垫", gap, gapRatio };
}

// 缓存数据
const cache = new Map<string, any[]>();
let extraCache: Record<string, any> | null = null;
let restrictionsCache: any[] | null = null;

function loadProvinceData(province: string): any[] {
  if (cache.has(province)) return cache.get(province)!;
  const filePath = path.join(process.cwd(), "data", `schools_${province}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    cache.set(province, data);
    return data;
  } catch {
    return [];
  }
}

function loadExtraData(): Record<string, any> {
  if (extraCache) return extraCache;
  const filePath = path.join(process.cwd(), "data", "school_extra.json");
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    extraCache = {};
    for (const item of data) {
      extraCache[item.name] = item;
    }
    return extraCache;
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rankStr = searchParams.get("rank");
  const rank = rankStr ? parseInt(rankStr) : 35000;
  const province = searchParams.get("province") || "河南";
  
  // 考生身体条件（用于退档风险检查）
  const visionNormal = searchParams.get("vision_normal") === "true";
  const heightCm = searchParams.get("height_cm") ? parseInt(searchParams.get("height_cm")!) : undefined;
  const gender = (searchParams.get("gender") as 'male' | 'female') || undefined;
  const politicalReviewPassed = searchParams.get("political_review_passed") === "true";
  const singleSubjects = searchParams.get("single_subjects")?.split(',') || [];

  const schools = loadProvinceData(province);
  const extraData = loadExtraData();

  // 位次匹配 + 风险评分 + 退档风险检查 + 补充数据
  const scored = schools.map((item: any) => {
    const minRank = item.min_rank || 99999;
    const { tier, gap, gapRatio } = tierFor(rank, minRank);
    const confidence = gapRatio < -0.05 ? "低" : gapRatio < 0.03 ? "中" : gapRatio < 0.15 ? "高" : "很高";

    const extra = extraData[item.school_name];
    
    // P0-1: 退档风险检查
    const retireRisk = checkRetireRisk(item.school_name, item.major_name, {
      vision_normal: visionNormal,
      height_cm: heightCm,
      gender,
      single_subjects: singleSubjects,
      political_review_passed: politicalReviewPassed
    });

    return {
      tier,
      school: item.school_name,
      major: item.major_name,
      min_rank: minRank,
      min_score: item.min_score,
      gap,
      gap_ratio: Math.round(gapRatio * 1000) / 1000,
      confidence,
      reason: `${item.school_type}院校`,
      risk: "请核对招生章程和计划变化",
      // P0-1: 退档风险预警
      retire_risk_warnings: retireRisk.warnings,
      has_retire_risk: retireRisk.warnings.length > 0,
      // 保研率+薪资补充数据
      baoyan_rate: extra?.baoyan_rate ?? null,
      avg_salary: extra?.avg_salary ?? null,
      salary_3y: extra?.salary_3y ?? null,
      salary_5y: extra?.salary_5y ?? null,
      employment_rate: extra?.employment_rate ?? null,
      top_employers: extra?.top_employers ?? [],
      school_province: extra?.province ?? null,
    };
  });

  // 按 tier 排序
  const tierOrder: Record<string, number> = { "冲": 0, "小冲": 1, "稳": 2, "保": 3, "垫": 4 };
  scored.sort((a, b) => (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99));

  return NextResponse.json({
    suggestions: scored.slice(0, 30),
    total: scored.length,
    profile: { province, rank, track: "physics", year: searchParams.get("year") || "2026" },
  });
}
