import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * 一分一段表条目
 */
interface RankTableEntry {
  score: number;
  count: number;
  cumulative: number;
}

/**
 * 换算结果
 */
interface ConversionResult {
  year: string;
  equivalent_score: number | null;
  note: string;
}

/**
 * 缓存: province_track_year → RankTableEntry[]
 */
const tableCache = new Map<string, RankTableEntry[]>();

/**
 * 加载一分一段表
 */
function loadRankTable(province: string, track: string, year: string): RankTableEntry[] {
  const key = `${province}_${track}_${year}`;
  if (tableCache.has(key)) return tableCache.get(key)!;

  const filePath = path.join(process.cwd(), "data", "rank_tables", `${province}_${track}_${year}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as RankTableEntry[];
    tableCache.set(key, data);
    return data;
  } catch {
    return [];
  }
}

/**
 * 根据 rank 在一分段表中查找对应的分数
 * 使用二分查找: 找到 cumulative >= rank 的最小 score
 */
function rankToScore(table: RankTableEntry[], rank: number): number | null {
  if (table.length === 0) return null;

  // 处理边界
  if (rank <= table[0].cumulative) return table[0].score;
  if (rank > table[table.length - 1].cumulative) return table[table.length - 1].score;

  // 二分查找
  let lo = 0;
  let hi = table.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (table[mid].cumulative >= rank) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return table[lo].score;
}

/**
 * 根据 score 在一分段表中查找对应的 rank
 */
function scoreToRank(table: RankTableEntry[], score: number): number | null {
  for (const entry of table) {
    if (entry.score <= score) {
      return entry.cumulative;
    }
  }
  return table[table.length - 1]?.cumulative ?? null;
}

/**
 * GET /api/convert-rank?province=河南&track=物理类&rank=35241&year=2026
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const province = searchParams.get("province") || "河南";
  const track = searchParams.get("track") || "物理类";
  const rankStr = searchParams.get("rank");
  const year = searchParams.get("year") || "2026";

  if (!rankStr || isNaN(parseInt(rankStr))) {
    return NextResponse.json({ error: "请提供有效的位次" }, { status: 400 });
  }

  const rank = parseInt(rankStr);

  // 目标年份对应的等效分数
  const results: ConversionResult[] = [];

  // 需要换算的往年年份
  const targetYears = ["2025", "2024"];

  for (const targetYear of targetYears) {
    const table = loadRankTable(province, track, targetYear);
    if (table.length === 0) {
      results.push({
        year: targetYear,
        equivalent_score: null,
        note: `暂无${targetYear}年${province}${track}一分一段表数据`,
      });
      continue;
    }

    const eqScore = rankToScore(table, rank);
    if (eqScore === null) {
      results.push({
        year: targetYear,
        equivalent_score: null,
        note: "位次超出数据范围",
      });
      continue;
    }

    // 计算置信度
    const dataRange = table[0].cumulative - table[table.length - 1].cumulative;
    const position = (table[0].cumulative - rank) / dataRange;
    const confidence = position < 0.05 || position > 0.95 ? "较低" : position < 0.15 || position > 0.85 ? "中等" : "较高";

    results.push({
      year: targetYear,
      equivalent_score: eqScore,
      note: `基于${targetYear}年一分一段表换算`,
    });
  }

  // 同时也返回当前年份的 rank → score (如果有一分一段表)
  const currentTable = loadRankTable(province, track, year);
  let currentScore: number | null = null;
  if (currentTable.length > 0) {
    currentScore = rankToScore(currentTable, rank);
  }

  return NextResponse.json({
    province,
    track,
    input: { year, rank },
    current_score: currentScore,
    equivalent: results,
    disclaimer: "换算基于一分一段表模型数据，仅供参考，最终以各省考试院官方数据为准",
  });
}
