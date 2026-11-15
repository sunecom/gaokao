#!/usr/bin/env python3
"""
高考数据爬虫 V2 — 高效采集
策略：
  1. 从阳光高考(chsi)爬取院校库（分页+省份筛选）
  2. 从阳光高考每个院校详情页爬取历年分数线
  3. 输出标准化 CSV
"""

import asyncio
import csv
import re
import sys
from pathlib import Path
from crawl4ai import AsyncWebCrawler

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

CHSI_BASE = "https://gaokao.chsi.com.cn"


async def crawl_province_schools(crawler: AsyncWebCrawler, province_code: str, province_name: str) -> list[dict]:
    """
    爬取阳光高考某省院校列表（分页）
    河南代码: 41 (从页面URL获取)
    """
    print(f"\n🌐 爬取 {province_name} (code={province_code}) 院校列表...")
    schools = []
    page = 0
    page_size = 20

    while True:
        url = f"{CHSI_BASE}/sch/search--ss-on,option-qg,searchType-1,start-{page}.dhtml"
        if province_code:
            url = f"{CHSI_BASE}/sch/search--ss-on,option-qg,searchType-1,province-{province_code},start-{page}.dhtml"

        result = await crawler.arun(url=url, word_count_threshold=5)
        text = result.markdown

        # 用正则提取院校信息
        # 格式: [ 北京大学 ] [ 北京|主管部门：教育部 ] [ 本科 |"双一流"建设高校 ]
        pattern = r'\[\s*([\u4e00-\u9fff\w]+(?:大学|学院|职业技术学院|专科学校|分校|校区|职业大学|高专|学院|学校))\s*\]'
        found = re.findall(pattern, text)
        # 去重（保持顺序）
        seen = set()
        for name in found:
            if name not in seen:
                seen.add(name)
                schools.append({"name": name, "province": province_name})

        print(f"   第 {page//20 + 1} 页: 找到 {len(found)} 个 (累计 {len(schools)} 个)")

        # 检查是否有下一页
        if "下一页" not in text and "›" not in text:
            break

        page += page_size
        await asyncio.sleep(0.5)  # 礼貌间隔

    return schools


async def crawl_school_scores(crawler: AsyncWebCrawler, school_name: str, sch_id: int) -> dict | None:
    """
    爬取单个院校的录取分数线
    阳光高考院校详情页格式: /sch/schoolInfo--schId-{id}.dhtml
    分数线页: /sch/schoolInfo--schId-{id},province-{provinceId},category-{category}.dhtml
    """
    url = f"{CHSI_BASE}/sch/schoolInfo--schId-{sch_id}.dhtml"
    try:
        result = await crawler.arun(url=url, word_count_threshold=10)
        text = result.markdown

        # 查找分数线数据
        score_sections = []
        lines = text.split("\n")
        in_score = False
        for line in lines:
            if "录取分数线" in line or "分数线" in line or "录取最低分" in line:
                in_score = True
            if in_score:
                score_sections.append(line)
                if len(score_sections) > 30:
                    break

        if score_sections:
            return {
                "school": school_name,
                "sch_id": sch_id,
                "has_score_data": True,
                "score_text": "\n".join(score_sections[:20])
            }
        return {"school": school_name, "sch_id": sch_id, "has_score_data": False}

    except Exception as e:
        return {"school": school_name, "sch_id": sch_id, "error": str(e)}


async def crawl_gaokao_cn_schools():
    """从掌上高考爬取院校列表"""
    from crawl4ai import AsyncWebCrawler

    print(f"\n🌐 爬取掌上高考院校列表...")
    url = "https://m.gaokao.cn/school/search"

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url, word_count_threshold=5)
        text = result.markdown

        # 保存原始内容
        (DATA_DIR / "gaokao_cn_schools_raw.txt").write_text(text[:50000], encoding="utf-8")

        # 找院校名
        schools = re.findall(r'[\u4e00-\u9fff]{2,}(?:大学|学院|职业技术学院|职业大学|专科学校)', text)
        print(f"   提取到 {len(schools)} 个院校名")
        for s in schools[:15]:
            print(f"   - {s}")

        return schools


async def main():
    print("=" * 60)
    print("🎯 高考数据爬虫 V2")
    print("=" * 60)

    async with AsyncWebCrawler() as crawler:
        # 1. 测试连通
        test = await crawler.arun(url=f"{CHSI_BASE}/sch/", word_count_threshold=5)
        print(f"\n✅ 阳光高考连通: {len(test.markdown)}字符")

        # 2. 从河南开始，爬院校列表
        # 省份代码：河南=41（从页面URL获取到）
        schools = await crawl_province_schools(crawler, "41", "河南")
        print(f"\n📋 河南院校: 共 {len(schools)} 所")

        # 保存院校列表
        csv_path = DATA_DIR / "schools_henan.csv"
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["name", "province"])
            w.writeheader()
            w.writerows(schools)
        print(f"💾 已保存: {csv_path}")

        # 3. 爬取前10所院校的分数线（测试）
        print(f"\n🌐 爬取前10所院校分数线（测试）...")
        for i, school in enumerate(schools[:10]):
            # 阳光高考院校ID从页面链接获取
            # schId=1 是北京大学，ID按顺序
            sch_id = i + 3000  # 需要映射，河南院校的ID不同
            result = await crawl_school_scores(crawler, school["name"], sch_id)
            status = "✅ 有分数线" if result.get("has_score_data") else "❌ 无数据"
            print(f"   {i+1}. {school['name']}: {status}")
            await asyncio.sleep(0.3)

        # 4. 也爬掌上高考
        gk_schools = await crawl_gaokao_cn_schools()

    print("\n" + "=" * 60)
    print("✅ 爬取完成")
    print(f"📁 数据目录: {DATA_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
