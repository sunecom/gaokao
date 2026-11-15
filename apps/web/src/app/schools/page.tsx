"use client";

import { useState } from "react";

const DEMO_SCHOOLS = [
  { name: "郑州大学", level: "211/双一流", city: "郑州", type: "综合", rank: 46, score: 589, baoyan: "18.5%", salary: "8.2k" },
  { name: "河南大学", level: "双一流", city: "开封/郑州", type: "综合", rank: 98, score: 567, baoyan: "12.3%", salary: "7.1k" },
  { name: "河南科技大学", level: "省重点", city: "洛阳", type: "理工", rank: 167, score: 545, baoyan: "6.8%", salary: "6.5k" },
  { name: "河南理工大学", level: "省重点", city: "焦作", type: "理工", rank: 192, score: 538, baoyan: "5.5%", salary: "6.3k" },
  { name: "河南工业大学", level: "省重点", city: "郑州", type: "理工", rank: 201, score: 535, baoyan: "5.2%", salary: "6.2k" },
  { name: "华北水利水电大学", level: "省重点", city: "郑州", type: "理工", rank: 278, score: 528, baoyan: "4.8%", salary: "6.0k" },
];

export default function SchoolsPage() {
  const [query, setQuery] = useState("");
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-4">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-sky-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          ← 返回首页
        </a>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">🏫 院校探索</h1>
      <input
        type="text"
        placeholder="搜索院校名称..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-4 py-3 border border-slate-300 rounded-xl mb-6 focus:ring-2 focus:ring-sky-500 outline-none"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="text-left px-4 py-3">院校</th><th className="text-left px-4 py-3">层次</th>
              <th className="text-left px-4 py-3">城市</th><th className="text-left px-4 py-3">类型</th>
              <th className="text-right px-4 py-3">全国排名</th><th className="text-right px-4 py-3">预估分数线</th>
              <th className="text-right px-4 py-3">保研率</th><th className="text-right px-4 py-3">应届起薪</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_SCHOOLS.filter(s => s.name.includes(query)).map((s, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3">{s.level}</td>
                <td className="px-4 py-3">{s.city}</td>
                <td className="px-4 py-3">{s.type}</td>
                <td className="px-4 py-3 text-right">{s.rank}</td>
                <td className="px-4 py-3 text-right text-sky-600 font-semibold">{s.score}</td>
                <td className="px-4 py-3 text-right">{s.baoyan}</td>
                <td className="px-4 py-3 text-right">{s.salary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-slate-400 text-center">* 数据为示例，正式版接入官方数据</p>
    </div>
  );
}
