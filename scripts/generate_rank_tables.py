#!/usr/bin/env python3
"""
生成 一分一段表 (score-rank distribution tables)
基于现有 admission data 的 anchor points + 已知省份分布规律补全

生成的数据为预估值，仅供参考。正式使用时请替换为各省考试院官方数据。
"""

import json
import math
import os

# ── 配置 ──────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
ADMISSION_FILE = os.path.join(DATA_DIR, "schools_河南.json")
OUTPUT_DIR = os.path.join(DATA_DIR, "rank_tables")
PROVINCE = "河南"
TRACK = "物理类"

# 典型 河南 物理类 控制点 (根据公开信息)
# 700分以上 ≈ 50人, 一本线 ≈ 515分 ≈ 130,000名, 本科线 ≈ 405分 ≈ 330,000名
CONTROL_POINTS = [
    (710, 10),    # 最高分
    (700, 50),
    (690, 200),
    (680, 800),
    (670, 2000),
    (660, 4500),
    (650, 8500),
    (640, 14000),
    (630, 22000),
    (620, 32000),
    (610, 45000),
    (600, 60000),
    (590, 78000),
    (580, 98000),
    (570, 120000),
    (560, 145000),
    (550, 172000),
    # 一本线附近
    (520, 220000),
    (510, 245000),
    (500, 270000),
    # 本科线附近
    (410, 325000),
    (400, 338000),
    (390, 350000),
    (370, 365000),
    (350, 378000),
    (320, 390000),
    (300, 398000),
    (250, 408000),
    (200, 415000),  # 最底线
]

# 2024 → 2025 分数线偏移 (河南物理类通常有 ±5 分波动)
# 这里我们假设 2025 比 2024 略难，整体分数线下移 3 分
YEAR_SHIFT = {"2024": 0, "2025": -3}


def anchor_to_points(records, default_control):
    """从录取数据提取 anchor + 与控制点融合"""
    score_ranks = {}
    for r in records:
        s = r.get("min_score")
        rk = r.get("min_rank")
        if s and rk:
            if s not in score_ranks or rk < score_ranks[s]:
                score_ranks[s] = rk

    # 从 anchor 构建 points
    anchors = sorted(score_ranks.items(), key=lambda x: -x[0])

    # 把 anchor 融入 control points
    # rule: anchor 在 control 同分数段, 取更优 (小) 的 rank
    merged = {}
    for s, rk in default_control:
        merged[s] = rk
    for s, rk in anchors:
        if s not in merged or rk < merged[s]:
            merged[s] = rk

    return sorted(merged.items(), key=lambda x: -x[0])


def interpolate_table(points):
    """
    从控制点生成完整 1 分一段表 (每分一条记录)
    返回: [(score, cumulative_rank), ...]
    """
    table = []
    # 从最高分到最低分遍历
    for score in range(points[0][0], points[-1][0] - 1, -1):
        # 找到包围 score 的两个控制点
        upper = None
        lower = None
        for s, rk in points:
            if s >= score and (upper is None or s < upper[0]):
                upper = (s, rk)
            if s <= score and (lower is None or s > lower[0]):
                lower = (s, rk)

        if upper and lower:
            if upper[0] == lower[0]:
                rank = upper[1]
            else:
                # 线性插值 (在 rank 空间)
                fraction = (score - lower[0]) / (upper[0] - lower[0])
                rank = int(lower[1] + (upper[1] - lower[1]) * fraction)
        elif upper:
            rank = upper[1]
        elif lower:
            rank = lower[1]
        else:
            continue

        table.append((score, rank))

    return sorted(table, key=lambda x: -x[0])


def apply_year_shift(table, shift):
    """对每年的分数线做偏移"""
    if shift == 0:
        return table
    result = []
    for score, rank in table:
        new_score = score + shift
        if new_score >= 200:  # 有效分数
            result.append((new_score, rank))
    return result


def compute_density(table):
    """计算每个分数的考生人数 (用于校验)"""
    density = []
    for i in range(len(table) - 1):
        curr_score, curr_rank = table[i]
        next_score, next_rank = table[i + 1]
        count = next_rank - curr_rank
        density.append((curr_score, count))
    return density


def save_table(table, province, track, year):
    """保存为一分段表 JSON"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 格式: [{score: 680, count: 12, cumulative: 800}, ...]
    records = []
    prev_rank = None
    for score, rank in sorted(table, key=lambda x: -x[0]):
        count = rank - prev_rank if prev_rank is not None else rank
        records.append({
            "score": score,
            "count": count,
            "cumulative": rank,
        })
        prev_rank = rank

    filename = f"{province}_{track}_{year}.json"
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print(f"✅ 已生成: {filepath} ({len(records)} 条记录)")
    print(f"   分数范围: {records[-1]['score']} - {records[0]['score']}")
    print(f"   位次范围: {records[-1]['cumulative']} - {records[0]['cumulative']}")
    return filepath


def main():
    # 加载录取数据
    with open(ADMISSION_FILE, encoding="utf-8") as f:
        records = json.load(f)

    # 融合 anchor + control points
    points = anchor_to_points(records, CONTROL_POINTS)
    print(f"控制点数量: {len(points)}")

    # 生成基准表 (2024)
    base_table = interpolate_table(points)
    print(f"插值后基准表记录数: {len(base_table)}")

    # 生成年度表
    for year in ["2024", "2025"]:
        shift = YEAR_SHIFT.get(year, 0)
        year_table = apply_year_shift(base_table, shift)
        save_table(year_table, PROVINCE, TRACK, year)

    # 统计密度 (验证合理性)
    density = compute_density(base_table)
    high_density = [d for d in density if d[0] >= 400]
    avg_count = sum(d[1] for d in high_density) / max(len(high_density), 1)
    total_students = base_table[-1][1] if base_table else 0
    print(f"\n📊 基准表统计:")
    print(f"   总考生数 (200分以上): {total_students:,}")
    print(f"   400分以上平均每分段人数: {avg_count:.0f}")
    print(f"   最高分段 (700+) 人数占比: {density[0][1] / total_students * 100:.4f}%")

    print("\n✅ 完成！替换为官方数据后更新 CONTROL_POINTS 即可。")


if __name__ == "__main__":
    main()
