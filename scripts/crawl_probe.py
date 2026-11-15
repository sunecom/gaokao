#!/usr/bin/env python3
"""
高考数据爬虫 V3 — 精准采集
直接从阳光高考爬取指定省份的院校 + 分数线
"""

import asyncio, csv, re, json
from pathlib import Path
from crawl4ai import AsyncWebCrawler

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
CHSI = "https://gaokao.chsi.com.cn"


async def crawl_school_detail(crawler, sch_id: int):
    """爬取单个院校详情页，提取分数线信息"""
    url = f"{CHSI}/sch/schoolInfo--schId-{sch_id}.dhtml"
    result = await crawler.arun(url=url, word_count_threshold=5)
    text = result.markdown

    # 提取院校名
    name_match = re.search(r'\[\s*([\u4e00-\u9fff]{2,}(?:大学|学院))\s*\]', text)
    name = name_match.group(1) if name_match else f"schId-{sch_id}"

    # 提取分数线相关段落
    score_lines = []
    capture = False
    for line in text.split('\n'):
        if any(kw in line for kw in ['分数线', '录取', '最低分', '投档', '位次']):
            capture = True
        if capture:
            score_lines.append(line.strip())
            if len(score_lines) >= 15:
                break

    return {
        "sch_id": sch_id,
        "name": name,
        "has_scores": len(score_lines) > 3,
        "score_preview": '\n'.join(score_lines[:8]) if score_lines else ""
    }


async def main():
    async with AsyncWebCrawler() as crawler:
        print("🔍 使用省份过滤搜索院校...")

        # 先爬首页看省份代码和第一页
        for province_code in ["41", "hn", "henan"]:
            url = f"{CHSI}/sch/search--ss-on,option-qg,searchType-1,province-{province_code},start-0.dhtml"
            result = await crawler.arun(url=url, word_count_threshold=5)
            print(f"\n   province={province_code}: {len(result.markdown)}字符, 标题={result.metadata.get('title','')[:50]}")
            # 保存
            (DATA_DIR / f"chsi_test_{province_code}.txt").write_text(result.markdown[:10000], encoding="utf-8")

        # 试试不同学校ID看详情页
        print("\n🔍 测试院校详情页...")
        for sid in [1, 10001, 20001, 30001]:
            info = await crawl_school_detail(crawler, sid)
            print(f"   ID={sid}: {info['name']} | 有分数线={info['has_scores']}")
            if info['has_scores'] and info['score_preview']:
                print(f"     预览: {info['score_preview'][:200]}")

    print("\n✅ 探测完成")


if __name__ == "__main__":
    asyncio.run(main())
