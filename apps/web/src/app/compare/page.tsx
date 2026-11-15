"use client";

import { useState } from "react";

const SCHOOLS = ["郑州大学", "河南大学", "河南科技大学", "河南理工大学", "华北水利水电大学"];

const SCHOOL_DATA: Record<string, any> = {
  "郑州大学": { level: "211/双一流", city: "郑州", type: "综合", rank: 46, baoyan: "18.5%", salary: "8.2k", fee: "5,500", students: "5.5万" },
  "河南大学": { level: "双一流", city: "开封/郑州", type: "综合", rank: 98, baoyan: "12.3%", salary: "7.1k", fee: "5,000", students: "4.2万" },
  "河南科技大学": { level: "省重点", city: "洛阳", type: "理工", rank: 167, baoyan: "6.8%", salary: "6.5k", fee: "4,500", students: "3.8万" },
  "河南理工大学": { level: "省重点", city: "焦作", type: "理工", rank: 192, baoyan: "5.5%", salary: "6.3k", fee: "4,500", students: "3.5万" },
  "华北水利水电大学": { level: "省重点", city: "郑州", type: "理工", rank: 278, baoyan: "4.8%", salary: "6.0k", fee: "4,000", students: "3.0万" },
};

export default function ComparePage() {
  const [schoolA, setSchoolA] = useState("郑州大学");
  const [schoolB, setSchoolB] = useState("河南大学");

  const a = SCHOOL_DATA[schoolA];
  const b = SCHOOL_DATA[schoolB];

  const fields = [
    { label: "办学层次", key: "level" },
    { label: "城市", key: "city" },
    { label: "类型", key: "type" },
    { label: "全国排名", key: "rank" },
    { label: "保研率", key: "baoyan" },
    { label: "应届起薪", key: "salary" },
    { label: "学费/年", key: "fee" },
    { label: "在校生数", key: "students" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-4">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-sky-700 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          ← 返回首页
        </a>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">🔄 院校对比</h1>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <select value={schoolA} onChange={e => setSchoolA(e.target.value)}
          className="px-4 py-3 border border-slate-300 rounded-xl outline-none">
          {SCHOOLS.filter(s => s !== schoolB).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={schoolB} onChange={e => setSchoolB(e.target.value)}
          className="px-4 py-3 border border-slate-300 rounded-xl outline-none">
          {SCHOOLS.filter(s => s !== schoolA).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-left px-4 py-3 w-32">对比维度</th>
              <th className="text-center px-4 py-3 text-sky-700 font-semibold">{schoolA}</th>
              <th className="text-center px-4 py-3 text-emerald-700 font-semibold">{schoolB}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{f.label}</td>
                <td className="px-4 py-3 text-center font-medium">{a?.[f.key]}</td>
                <td className="px-4 py-3 text-center font-medium">{b?.[f.key]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
