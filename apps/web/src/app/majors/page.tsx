"use client";

const MAJORS = [
  { name: "计算机科学与技术", category: "工学", trend: "上升期", aiRisk: "低", salary: "10.2k", growth: "15%", baokao: "22%" },
  { name: "软件工程", category: "工学", trend: "上升期", aiRisk: "低", salary: "9.8k", growth: "13%", baokao: "18%" },
  { name: "电气工程及其自动化", category: "工学", trend: "稳健期", aiRisk: "低", salary: "8.5k", growth: "8%", baokao: "12%" },
  { name: "临床医学", category: "医学", trend: "稳健期", aiRisk: "极低", salary: "8.0k", growth: "10%", baokao: "25%" },
  { name: "法学", category: "法学", trend: "饱和期", aiRisk: "中", salary: "6.5k", growth: "3%", baokao: "15%" },
  { name: "会计学", category: "管理学", trend: "饱和期", aiRisk: "高", salary: "6.0k", growth: "2%", baokao: "8%" },
  { name: "电子信息工程", category: "工学", trend: "上升期", aiRisk: "低", salary: "9.0k", growth: "12%", baokao: "18%" },
  { name: "人工智能", category: "工学", trend: "爆发期", aiRisk: "极低", salary: "12.0k", growth: "25%", baokao: "20%" },
  { name: "数学与应用数学", category: "理学", trend: "稳健期", aiRisk: "中", salary: "7.2k", growth: "6%", baokao: "28%" },
  { name: "机械设计制造及其自动化", category: "工学", trend: "转型期", aiRisk: "中高", salary: "6.8k", growth: "4%", baokao: "10%" },
];

export default function MajorsPage() {
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
      <h1 className="text-2xl font-bold text-slate-800 mb-6">📚 专业解读</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="text-left px-4 py-3">专业</th><th className="text-left px-4 py-3">类别</th>
              <th className="text-left px-4 py-3">行业趋势</th><th className="text-left px-4 py-3">AI 替代风险</th>
              <th className="text-right px-4 py-3">应届起薪</th><th className="text-right px-4 py-3">薪资增长</th>
              <th className="text-right px-4 py-3">考研率</th>
            </tr>
          </thead>
          <tbody>
            {MAJORS.map((m, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3">{m.category}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    m.trend.includes("上升") || m.trend.includes("爆发") ? "bg-green-100 text-green-700" :
                    m.trend.includes("饱和") ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  }`}>{m.trend}</span>
                </td>
                <td className="px-4 py-3">{m.aiRisk}</td>
                <td className="px-4 py-3 text-right font-semibold">{m.salary}</td>
                <td className="px-4 py-3 text-right text-green-600">{m.growth}</td>
                <td className="px-4 py-3 text-right">{m.baokao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-slate-400 text-center">* 数据为示例，正式版接入教育部/麦可思等权威数据</p>
    </div>
  );
}
