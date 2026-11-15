"use client";

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">📊 数据看板</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 热榜 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">🔥 热门专业TOP5</h2>
          <div className="space-y-3">
            {[
              { rank: 1, name: "人工智能", heat: 98 },
              { rank: 2, name: "计算机科学与技术", heat: 95 },
              { rank: 3, name: "临床医学", heat: 88 },
              { rank: 4, name: "电气工程及其自动化", heat: 82 },
              { rank: 5, name: "数据科学与大数据技术", heat: 79 },
            ].map((m) => (
              <div key={m.rank} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  m.rank <= 3 ? "bg-red-500" : "bg-slate-400"
                }`}>{m.rank}</span>
                <span className="flex-1">{m.name}</span>
                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${m.heat}%` }} />
                </div>
                <span className="text-sm text-slate-500 w-8 text-right">{m.heat}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* 省份平均分 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">🏆 各省一本线TOP5</h2>
          <div className="space-y-3">
            {[
              { prov: "浙江", line: 595, change: "+3" },
              { prov: "海南", line: 578, change: "+2" },
              { prov: "北京", line: 560, change: "-1" },
              { prov: "河南", line: 545, change: "+5" },
              { prov: "山东", line: 532, change: "+1" },
            ].map((d, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="font-medium">{d.prov}</span>
                <span className="text-sky-600 font-semibold">{d.line}</span>
                <span className={d.change.startsWith("+") ? "text-green-600 text-sm" : "text-red-600 text-sm"}>
                  {d.change}分
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 就业薪资榜 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">💰 应届起薪TOP5</h2>
          <div className="space-y-3">
            {[
              { major: "人工智能", salary: "12.0k" },
              { major: "计算机科学与技术", salary: "10.2k" },
              { major: "软件工程", salary: "9.8k" },
              { major: "电子信息工程", salary: "9.0k" },
              { major: "电气工程", salary: "8.5k" },
            ].map((d, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span>{d.major}</span>
                <span className="text-green-600 font-semibold">{d.salary}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 保研率榜 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-700 mb-4">🎓 保研率TOP5</h2>
          <div className="space-y-3">
            {[
              { school: "清华大学", rate: "58.3%" },
              { school: "北京大学", rate: "54.8%" },
              { school: "中国科学技术大学", rate: "48.5%" },
              { school: "上海交通大学", rate: "42.0%" },
              { school: "复旦大学", rate: "38.7%" },
            ].map((d, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span>{d.school}</span>
                <span className="text-purple-600 font-semibold">{d.rate}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-6 text-xs text-slate-400 text-center">* 数据为示例展示，正式版接入权威数据源</p>
    </div>
  );
}
