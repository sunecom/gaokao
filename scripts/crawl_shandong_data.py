#!/usr/bin/env python3
"""
山东高考录取数据生成脚本
基于全国院校库 + 山东高考特点生成模拟录取数据
"""

import json
import csv
import os
import random
import sqlite3
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# 山东高考控制点 (2024年物理类，总考生约63万)
SHANDONG_CONTROL_POINTS_2024 = [
    (720, 5), (710, 20), (700, 80), (690, 300), (680, 800),
    (670, 2000), (660, 4500), (650, 8500), (640, 14000), (630, 22000),
    (620, 32000), (610, 45000), (600, 60000), (590, 78000), (580, 98000),
    (570, 120000), (560, 145000), (550, 172000), (540, 200000), (530, 230000),
    (520, 260000), (510, 290000), (500, 320000), (490, 350000), (480, 380000),
    (470, 410000), (460, 440000), (450, 470000), (440, 500000), (430, 525000),
    (420, 550000), (410, 570000), (400, 585000), (390, 595000), (380, 602000),
    (370, 607000), (360, 611000), (350, 614000), (300, 622000), (250, 626000),
    (200, 628000),
]

YEAR_SHIFT_2025 = -2

TIER_1_985 = {
    "北京大学", "清华大学", "复旦大学", "上海交通大学", "浙江大学",
    "南京大学", "中国科学技术大学", "哈尔滨工业大学", "西安交通大学",
    "中国人民大学", "北京航空航天大学", "北京理工大学", "南开大学",
    "天津大学", "同济大学", "华东师范大学", "东南大学", "厦门大学",
    "武汉大学", "华中科技大学", "中山大学", "华南理工大学", "四川大学",
    "电子科技大学", "重庆大学", "西北工业大学", "兰州大学", "山东大学",
    "中国海洋大学", "吉林大学", "大连理工大学", "东北大学", "中南大学",
    "湖南大学", "国防科技大学"
}

TIER_2_211 = {
    "北京交通大学", "北京工业大学", "北京科技大学", "北京化工大学",
    "北京邮电大学", "北京林业大学", "北京外国语大学", "中国传媒大学",
    "中央财经大学", "对外经济贸易大学", "北京体育大学", "中国政法大学",
    "华北电力大学", "中国矿业大学", "中国石油大学", "中国地质大学",
    "东北师范大学", "东华大学", "上海外国语大学", "上海财经大学",
    "南京航空航天大学", "南京理工大学", "中国药科大学", "南京师范大学",
    "苏州大学", "江南大学", "河海大学", "安徽大学", "合肥工业大学",
    "福州大学", "南昌大学", "郑州大学", "河南大学", "华中师范大学",
    "华中农业大学", "中南财经政法大学", "湖南师范大学", "暨南大学",
    "华南师范大学", "广西大学", "海南大学", "西南交通大学", "西南大学",
    "西南财经大学", "四川农业大学", "贵州大学", "云南大学", "西藏大学",
    "西北大学", "西安电子科技大学", "长安大学", "陕西师范大学",
    "青海大学", "宁夏大学", "新疆大学", "石河子大学"
}

MAJORS = [
    "计算机科学与技术", "电子信息工程", "软件工程", "人工智能",
    "数据科学与大数据技术", "物联网工程", "通信工程", "自动化",
    "机械电子工程", "电气工程及其自动化", "临床医学", "口腔医学",
    "法学", "金融学", "会计学", "汉语言文学", "英语", "新闻学",
    "建筑学", "土木工程", "化学工程与工艺", "材料科学与工程",
    "生物医学工程", "环境科学", "数学与应用数学", "物理学",
]


def load_schools():
    """从全国院校库加载学校列表"""
    schools_csv = DATA_DIR / "schools_national.csv"
    if schools_csv.exists():
        with open(schools_csv, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return [(row['sch_id'], row['name']) for row in reader]
    
    # Fallback: 从 summary JSON 加载
    summary_json = DATA_DIR / "schools_summary.json"
    if summary_json.exists():
        with open(summary_json, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return [(s['sch_id'], s['name']) for s in data]
    
    return []


def get_school_tier(name):
    """判断学校层次"""
    if name in TIER_1_985:
        return 1
    elif name in TIER_2_211:
        return 2
    else:
        return 3


def generate_admission_records(schools):
    """生成山东录取数据"""
    records = []
    random.seed(42)  # 可复现
    
    for sch_id, name in schools:
        tier = get_school_tier(name)
        
        # 根据层次确定分数段 (山东分数线通常比河南高5-10分)
        if tier == 1:  # 985
            base_score = random.randint(630, 710)
            base_rank = random.randint(100, 15000)
        elif tier == 2:  # 211
            base_score = random.randint(570, 640)
            base_rank = random.randint(15000, 80000)
        else:  # 普通本科
            base_score = random.randint(450, 580)
            base_rank = random.randint(80000, 500000)
        
        school_type = "公办"
        if "民办" in name or "独立" in name:
            school_type = "民办"
        if "职业" in name or "专科" in name:
            school_type = "高职(专科)"
        
        # 为每所学校生成2-3个专业
        num_majors = random.choice([2, 2, 3])
        selected_majors = random.sample(MAJORS, min(num_majors, len(MAJORS)))
        
        for major in selected_majors: