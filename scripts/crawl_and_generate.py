#!/usr/bin/env python3
"""
高考数据爬虫 — 院校库 + 模拟分数线
策略：
  1. 从阳光高考爬取全国院校库（分页全量）
  2. 为 MVP 生成模拟的历年录取分数线（基于院校层次 + 专业热度）
  3. 生成符合 data-contract 规范的 CSV
"""

import asyncio, csv, re, random
from pathlib import Path
from crawl4ai import AsyncWebCrawler

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
CHSI = "https://gaokao.chsi.com.cn"

# ── TODO: 下次爬取时补充学校所在地属性 ──
# 当前数据缺失学校所在地（省份/城市），导致无法按地域过滤。
# 下次爬取时从阳光高考院校详情页补充：province + city

# 院校层次分类（用于后面对应分数段）
SCHOOL_LEVELS = {
    "北京大学": 1, "清华大学": 1, "复旦大学": 1, "上海交通大学": 1, "浙江大学": 1,
    "南京大学": 1, "中国科学技术大学": 1, "哈尔滨工业大学": 1, "西安交通大学": 1,
}
TIER_1_985 = {"北京大学", "清华大学", "复旦大学", "上海交通大学", "浙江大学", "南京大学",
              "中国科学技术大学", "哈尔滨工业大学", "西安交通大学", "中国人民大学",
              "北京航空航天大学", "北京理工大学", "南开大学", "天津大学", "同济大学",
              "华东师范大学", "东南大学", "厦门大学", "武汉大学", "华中科技大学",
              "中山大学", "华南理工大学", "四川大学", "电子科技大学", "重庆大学",
              "西北工业大学", "兰州大学", "山东大学", "中国海洋大学", "吉林大学",
              "大连理工大学", "东北大学", "中南大学", "湖南大学", "国防科技大学"}

TIER_2_211 = {"北京交通大学", "北京工业大学", "北京科技大学", "北京化工大学", "北京邮电大学",
              "北京林业大学", "北京外国语大学", "中国传媒大学", "中央财经大学", "对外经济贸易大学",
              "北京体育大学", "中国政法大学", "华北电力大学", "中国矿业大学", "中国石油大学",
              "中国地质大学", "东北师范大学", "东华大学", "上海外国语大学", "上海财经大学",
              "南京航空航天大学", "南京理工大学", "中国药科大学", "南京师范大学",
              "苏州大学", "江南大学", "河海大学", "安徽大学", "合肥工业大学",
              "福州大学", "南昌大学", "郑州大学", "河南大学", "华中师范大学",
              "华中农业大学", "中南财经政法大学", "湖南师范大学", "暨南大学",
              "华南师范大学", "广西大学", "海南大学", "西南交通大学", "西南大学",
              "西南财经大学", "四川农业大学", "贵州大学", "云南大学", "西藏大学",
              "西北大学", "西安电子科技大学", "长安大学", "陕西师范大学",
              "青海大学", "宁夏大学", "新疆大学", "石河子大学"}


async def crawl_all_schools(crawler: AsyncWebCrawler) -> list[dict]:
    """遍历阳光高考所有页面，提取全部院校"""
    print("🌐 正在爬取全国院校列表...")
    all_schools = []
    page = 0
    page_size = 20
    max_empty = 0

    while max_empty < 3:
        url = f"{CHSI}/sch/search--ss-on,option-qg,searchType-1,start-{page}.dhtml"
        result = await crawler.arun(url=url, word_count_threshold=5)
        text = result.markdown

        # 从链接中提取 [学校名] 和 URL
        # 格式: [学校名](https://...schId-{ID}.dhtml)
        schools_page = []
        for match in re.finditer(r'\[\s*([\u4e00-\u9fff]{2,}(?:大学|学院))\s*\]\(https?://[^)]*?schId-(\d+)\.dhtml\)', text):
            name, sch_id = match.group(1), int(match.group(2))
            if name not in {s["name"] for s in all_schools}:
                schools_page.append({"name": name, "sch_id": sch_id})

        all_schools.extend(schools_page)
        print(f"   第 {page//20 + 1} 页: +{len(schools_page)} 所 (累计 {len(all_schools)})")

        if len(schools_page) == 0:
            max_empty += 1
        else:
            max_empty = 0

        page += page_size
        await asyncio.sleep(0.3)

    return all_schools


def generate_mock_admission_data(schools: list[dict], province: str = "河南", year: int = 2025) -> list[dict]:
    """
    基于院校层次生成模拟录取数据
    实际投产时替换为爬虫获取的各省考试院真实投档线
    """
    records = []
    base_url = "https://gaokao.chsi.com.cn/sch/schoolInfo--schId-{}.dhtml"

    for school in schools:
        name = school["name"]
        # 根据院校层次定分数段
        if name in TIER_1_985:
            base_score = random.randint(620, 680)
            base_rank = random.randint(2000, 8000)
        elif name in TIER_2_211:
            base_score = random.randint(560, 620)
            base_rank = random.randint(8000, 25000)
        else:
            base_score = random.randint(400, 560)
            base_rank = random.randint(25000, 120000)

        school_type = "公办"
        if "民办" in name or "独立" in name:
            school_type = "民办"
        if "职业" in name:
            school_type = "高职(专科)"

        records.append({
            "year": year,
            "province": province,
            "batch": "本科批" if base_score > 450 else "专科批",
            "subject_track": "物理类",
            "school_name": name,
            "school_code": str(school["sch_id"]),
            "major_name": "计算机科学与技术",
            "min_score": base_score,
            "min_rank": base_rank,
            "plan_count": random.randint(20, 200),
            "school_type": school_type,
            "source": base_url.format(school["sch_id"]),
        })

        # 第二专业
        major2_score = base_score - random.randint(0, 15)
        major2_rank = base_rank + random.randint(0, 3000)
        records.append({
            "year": year,
            "province": province,
            "batch": "本科批" if major2_score > 450 else "专科批",
            "subject_track": "物理类",
            "school_name": name,
            "school_code": str(school["sch_id"]),
            "major_name": "电子信息工程",
            "min_score": major2_score,
            "min_rank": major2_rank,
            "plan_count": random.randint(10, 150),
            "school_type": school_type,
            "source": base_url.format(school["sch_id"]),
        })

    return records


async def main():
    print("=" * 60)
    print("🎯 高考数据爬虫 — 院校库 + 模拟录取数据")
    print("=" * 60)

    async with AsyncWebCrawler() as crawler:
        schools = await crawl_all_schools(crawler)

    print(f"\n📋 共爬取 {len(schools)} 所院校")

    # 保存院校 CSV
    schools_csv = DATA_DIR / "schools_national.csv"
    with open(schools_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["sch_id", "name"])
        w.writeheader()
        for s in schools:
            w.writerow({"sch_id": s["sch_id"], "name": s["name"]})
    print(f"💾 院校库: {schools_csv}")

    # 生成模拟录取数据（河南 物理类）
    print("\n🔄 生成模拟录取数据...")
    data = generate_mock_admission_data(schools, province="河南", year=2025)

    # 保存录取数据 CSV
    data_csv = DATA_DIR / "admission_henan_2025.csv"
    fieldnames = ["year", "province", "batch", "subject_track",
                  "school_name", "school_code", "major_name",
                  "min_score", "min_rank", "plan_count", "school_type", "source"]
    with open(data_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(data)
    print(f"💾 录取数据: {data_csv} ({len(data)} 条记录)")

    # 生成缩略版供 Web UI 使用
    summary = []
    for s in schools[:300]:  # 取前300所
        if s["name"] in TIER_1_985:
            level = "985/双一流"
        elif s["name"] in TIER_2_211:
            level = "211/双一流"
        else:
            level = "普通本科"
        summary.append({"name": s["name"], "sch_id": s["sch_id"], "level": level})

    summary_json = DATA_DIR / "schools_summary.json"
    import json
    with open(summary_json, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print(f"💾 摘要JSON: {summary_json} ({len(summary)} 所)")

    # 显示统计
    from collections import Counter
    levels = Counter(s["name"] for s in schools if s["name"] in TIER_1_985)
    print(f"\n📊 统计: 985={sum(1 for s in schools if s['name'] in TIER_1_985)}, "
          f"211={sum(1 for s in schools if s['name'] in TIER_2_211)}, "
          f"其他={len(schools) - sum(1 for s in schools if s['name'] in TIER_1_985) - sum(1 for s in schools if s['name'] in TIER_2_211)}")

    print("\n✅ 完成!")


if __name__ == "__main__":
    asyncio.run(main())
