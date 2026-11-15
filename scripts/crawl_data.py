#!/usr/bin/env python3
"""
高考数据爬虫 — 爬取阳光高考 + 掌上高考数据
策略：先爬院校列表，再爬各省投档线
输出：CSV 格式，符合 data-contract 规范
"""

import asyncio
import csv
import json
import os
import sys
from pathlib import Path

# 确保能找到 crawai
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "crawai"))

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

async def test_sites():
    """测试各数据源连通性"""
    from crawl4ai import AsyncWebCrawler

    urls = [
        ("阳光高考", "https://gaokao.chsi.com.cn/"),
        ("掌上高考", "https://m.gaokao.cn/"),
        ("教育在线(河南)", "https://gaokao.eol.cn/he_nan/"),
    ]

    async with AsyncWebCrawler() as crawler:
        for name, url in urls:
            try:
                result = await crawler.arun(url=url, word_count_threshold=10)
                print(f"✅ {name}: {url}")
                print(f"   标题: {result.metadata.get('title', 'N/A')[:60]}")
                print(f"   内容长度: {len(result.markdown)}字符")
            except Exception as e:
                print(f"❌ {name}: {e}")
            print()


async def crawl_schools_from_chsi():
    """从阳光高考爬取院校列表"""
    from crawl4ai import AsyncWebCrawler

    print("🌐 爬取阳光高考院校列表...")
    base_url = "https://gaokao.chsi.com.cn/sch/"

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=base_url, word_count_threshold=10)
        text = result.markdown

        # 保存原始内容分析
        with open(DATA_DIR / "chsi_schools_raw.txt", "w", encoding="utf-8") as f:
            f.write(text[:50000])

        # 查找院校列表
        schools = []
        lines = text.split("\n")
        for i, line in enumerate(lines):
            if any(kw in line for kw in ["大学", "学院", "职业技术学院"]):
                if len(line.strip()) > 2 and len(line.strip()) < 50:
                    schools.append(line.strip())

        print(f"   找到 {len(schools)} 个院校名称")
        for s in schools[:20]:
            print(f"   - {s}")
        if len(schools) > 20:
            print(f"   ... 还有 {len(schools)-20} 个")

        return schools


async def crawl_gaokao_cn_scores(province: str = "河南"):
    """
    从掌上高考(m.gaokao.cn)爬取某省的院校录取分数线
    掌上高考使用了API，尝试直接调用其JSON接口
    """
    import aiohttp

    print(f"🌐 爬取掌上高考 {province} 省录取数据...")

    # 掌上高考的院校搜索 API
    search_api = "https://m.gaokao.cn/school/search"
    score_api = "https://m.gaokao.cn/school/{school_id}/provinceScore"

    async with aiohttp.ClientSession(headers={
        "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36",
        "Referer": "https://m.gaokao.cn/",
    }) as session:
        # 先搜索院校
        async with session.get(search_api, params={"key": "", "page": 1, "size": 50}) as resp:
            print(f"   搜索API返回: {resp.status}")
            try:
                data = await resp.json()
                print(f"   响应: {json.dumps(data, ensure_ascii=False, indent=2)[:500]}")
            except:
                text = await resp.text()
                print(f"   响应文本(前200): {text[:200]}")


async def main():
    print("=" * 60)
    print("🎯 高考数据爬虫 — 数据源测试与采集")
    print("=" * 60)
    print()

    # 1. 先测试连通性
    print("【1/3】测试数据源连通性")
    print("-" * 40)
    await test_sites()

    # 2. 爬取院校列表
    print("【2/3】爬取院校列表")
    print("-" * 40)
    schools = await crawl_schools_from_chsi()
    print()

    # 3. 爬取分数线
    print("【3/3】爬取录取分数线")
    print("-" * 40)
    await crawl_gaokao_cn_scores("河南")
    print()

    print("=" * 60)
    print("✅ 爬取完成")


if __name__ == "__main__":
    asyncio.run(main())
