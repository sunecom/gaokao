import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface EstimateInput {
  province: string;
  track: string;
  school_level: string;
  rank_in_school: number;
  total_students: number;
}

interface EstimateResult {
  estimated_rank_min: number;
  estimated_rank_max: number;
  estimated_rank_median: number;
  confidence: string;
  note: string;
  school_level_name?: string;
}

/**
 * 加载配置
 */
function loadConfig() {
  const configPath = path.join(process.cwd(), "data", "rank_estimate_config.json");
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * 估算省位次
 */
function estimateProvinceRank(input: EstimateInput, config: any): EstimateResult | null {
  const { province, track, school_level, rank_in_school, total_students } = input;

  // 查找学校层次配置
  const levelConfig = config.school_levels.find((l: any) => l.id === school_level);
  if (!levelConfig) return null;

  // 查找省份+科类配置
  const provinceConfig = config.province_configs?.[province]?.[track];
  const totalProvince = provinceConfig?.total_students_approx || 400000;

  // 计算校内排名百分比
  const percentile = rank_in_school / Math.max(total_students, 1);

  // 应用乘数估算省位次
  const estRankMin = Math.round(percentile * levelConfig.multiplier_min * totalProvince);
  const estRankMax = Math.round(percentile * levelConfig.multiplier_max * totalProvince);
  const estRankMedian = Math.round((estRankMin + estRankMax) / 2);

  // 置信度
  const rangeRatio = (estRankMax - estRankMin) / Math.max(estRankMedian, 1);
  let confidence = "中等";
  if (rangeRatio < 0.5) confidence = "较高";
  else if (rangeRatio < 1.0) confidence = "中等";
  else confidence = "较低";

  return {
    estimated_rank_min: Math.max(1, estRankMin),
    estimated_rank_max: Math.max(1, estRankMax),
    estimated_rank_median: Math.max(1, estRankMedian),
    confidence,
    note: `${levelConfig.confidence_note}。${provinceConfig?.note || "该省份数据为默认估算"}`,
    school_level_name: levelConfig.label,
  };
}

/**
 * GET /api/rank-estimate
 * 返回配置信息（学校层次列表）
 */
export async function GET() {
  const config = loadConfig();
  if (!config) {
    return NextResponse.json({ error: "配置加载失败" }, { status: 500 });
  }
  return NextResponse.json({
    title: config.title,
    description: config.description,
    school_levels: config.school_levels,
    disclaimer: config.disclaimer,
  });
}

/**
 * POST /api/rank-estimate
 * Body: { province, track, school_level, rank_in_school, total_students }
 */
export async function POST(request: NextRequest) {
  try {
    const config = loadConfig();
    if (!config) {
      return NextResponse.json({ error: "配置加载失败" }, { status: 500 });
    }

    const body = await request.json();
    const { province, track, school_level, rank_in_school, total_students } = body;

    if (!province || !school_level || !rank_in_school || !total_students) {
      return NextResponse.json({ error: "请填写所有必填项" }, { status: 400 });
    }

    if (rank_in_school < 1 || rank_in_school > total_students) {
      return NextResponse.json({ error: "校内排名超出年级总人数范围" }, { status: 400 });
    }

    const result = estimateProvinceRank(
      { province, track: track || "physics", school_level, rank_in_school, total_students },
      config
    );

    if (!result) {
      return NextResponse.json({ error: "学校层次配置不存在" }, { status: 404 });
    }

    return NextResponse.json({
      ...result,
      input: { province, track, school_level, rank_in_school, total_students },
      school_percentile: `${Math.round((rank_in_school / total_students) * 10000) / 100}%`,
      disclaimer: config.disclaimer,
    });
  } catch (error) {
    return NextResponse.json({ error: "服务器错误", detail: String(error) }, { status: 500 });
  }
}
