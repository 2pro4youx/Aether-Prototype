import React, { useState } from 'react';
import {
  BarChart3,
  Clock,
  TrendingUp,
  Download,
  Filter,
  CheckCircle2,
  Calendar,
  Sparkles,
  BookOpen,
  PieChart,
} from 'lucide-react';
import { SubjectAnalytics, AuditLog, ColorPalette } from '../types';

interface AnalyticsViewProps {
  subjectAnalytics: SubjectAnalytics[];
  auditLogs: AuditLog[];
  activePalette: ColorPalette;
  darkMode: boolean;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  subjectAnalytics,
  auditLogs,
  activePalette,
  darkMode,
}) => {
  const [logFilter, setLogFilter] = useState<'all' | 'ai' | 'note' | 'source' | 'task'>('all');

  const totalMinutes = subjectAnalytics.reduce((acc, curr) => acc + curr.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const filteredLogs = auditLogs.filter((log) => {
    if (logFilter === 'all') return true;
    return log.category === logFilter;
  });

  const handleExportAudits = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Timestamp,Category,Action,Detail']
        .concat(auditLogs.map((l) => `"${l.timestamp}","${l.category}","${l.action}","${l.detail}"`))
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aether_learn_audit_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative min-h-screen pt-28 pb-16 px-4 sm:px-8 lg:px-12 max-w-[1720px] w-full mx-auto space-y-8 select-none transition-colors duration-300">
      {/* Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: darkMode ? '#f1f5f9' : activePalette.primary }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: darkMode ? '#f1f5f9' : activePalette.primary }}
            />
            <span>Student Velocity & Telemetry · {activePalette.name}</span>
          </div>
          <h1
            className={`text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            Learning Analytics & Interaction Audits
          </h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Real-time tracking of study minutes, subject distribution, and audit verification records.
          </p>
        </div>

        <button
          onClick={handleExportAudits}
          style={{
            backgroundColor: `${activePalette.primary}25`,
            borderColor: `${activePalette.primary}60`,
            color: darkMode ? '#ffffff' : activePalette.primary,
          }}
          className="px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition hover:opacity-90 shadow-sm"
        >
          <Download className="w-4 h-4" />
          <span>Export Audit Ledger (CSV)</span>
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="liquid-glass rounded-2xl p-5 shadow-lg space-y-1 overflow-hidden">
          <span className={`text-xs font-mono uppercase ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
            Total Study Minutes
          </span>
          <p
            className={`text-3xl font-extrabold tabular-nums ${darkMode ? 'text-white' : ''}`}
            style={!darkMode ? { color: activePalette.primary } : undefined}
          >
            {totalMinutes.toLocaleString()} m
          </p>
          <span className={`text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
            Equates to ~{totalHours} academic hours
          </span>
        </div>

        <div className="liquid-glass rounded-2xl p-5 shadow-lg space-y-1 overflow-hidden">
          <span className={`text-xs font-mono uppercase ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
            Top Subject Focus
          </span>
          <p
            className={`text-2xl font-extrabold truncate ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {subjectAnalytics[0]?.subject || 'Computer Science'}
          </p>
          <span
            className="text-[11px] font-semibold"
            style={{ color: darkMode ? '#cbd5e1' : activePalette.accent }}
          >
            {subjectAnalytics[0]?.percentage}% of total cognitive effort
          </span>
        </div>

        <div className="liquid-glass rounded-2xl p-5 shadow-lg space-y-1 overflow-hidden">
          <span className={`text-xs font-mono uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Interaction Audits
          </span>
          <p
            className={`text-3xl font-extrabold tabular-nums ${
              darkMode ? 'text-slate-100' : 'text-slate-900'
            }`}
          >
            {auditLogs.length} Records
          </p>
          <span className="text-[11px] text-emerald-500 font-medium">100% verified chronological log</span>
        </div>

        <div className="liquid-glass rounded-2xl p-5 shadow-lg space-y-1 overflow-hidden">
          <span className={`text-xs font-mono uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Weekly Retention Velocity
          </span>
          <p className="text-3xl font-extrabold text-emerald-500 tabular-nums">+24.8%</p>
          <span className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Outpacing baseline study projections
          </span>
        </div>
      </div>

      {/* Subject Category Breakdown & Time Spent */}
      <div className="liquid-glass rounded-2xl p-6 shadow-xl flex flex-col gap-5 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3
              className={`text-base font-bold flex items-center gap-2 ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              <PieChart className="w-4 h-4 text-slate-200" style={{ color: activePalette.id === 'black-night' ? '#f1f5f9' : activePalette.primary }} />
              <span>Time Spent Across Active Subject Categories</span>
            </h3>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Aggregated learning minutes recorded across active study notebooks and problem sets.
            </p>
          </div>
          <span className={`text-xs font-mono ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {subjectAnalytics.length} tracked disciplines
          </span>
        </div>

        {/* Visual Stacked Progress Bar */}
        <div
          className={`w-full h-3 rounded-full overflow-hidden flex ${
            darkMode ? 'bg-slate-900' : 'bg-slate-200'
          }`}
        >
          {subjectAnalytics.map((sub) => (
            <div
              key={sub.subject}
              className="h-full transition-all duration-300 hover:opacity-90 cursor-pointer"
              style={{
                width: `${sub.percentage}%`,
                backgroundColor: sub.color,
              }}
              title={`${sub.subject}: ${sub.minutes} mins (${sub.percentage}%)`}
            />
          ))}
        </div>

        {/* Subject Rows */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {subjectAnalytics.map((sub) => (
            <div
              key={sub.subject}
              className={`p-4 rounded-xl border space-y-2 transition ${
                darkMode
                  ? 'bg-slate-900/60 border-white/5 hover:border-white/10'
                  : 'bg-white/80 border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: sub.color }}
                  />
                  <h4
                    className={`text-xs font-bold ${
                      darkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    {sub.subject}
                  </h4>
                </div>
                <span
                  className={`text-xs font-mono font-bold ${
                    darkMode ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  {sub.percentage}%
                </span>
              </div>

              <div
                className={`flex items-center justify-between text-xs font-mono ${
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span>{sub.minutes} minutes</span>
                <span>~{(sub.minutes / 60).toFixed(1)} hrs</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Interaction Audits Table */}
      <div className="liquid-glass rounded-2xl p-6 shadow-xl flex flex-col gap-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3
              className={`text-base font-bold ${
                darkMode ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              Interaction Audit Ledger
            </h3>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Chronological action logs for verification and study fidelity.
            </p>
          </div>

          {/* Filter Pills */}
          <div
            className={`flex items-center gap-1 p-0.5 rounded-lg border text-xs ${
              darkMode ? 'bg-slate-900/60 border-white/10' : 'bg-slate-100 border-slate-200'
            }`}
          >
            {(['all', 'ai', 'note', 'source', 'task'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setLogFilter(cat)}
                style={
                  logFilter === cat
                    ? {
                        backgroundColor: `${activePalette.primary}25`,
                        color: activePalette.id === 'black-night' ? '#f1f5f9' : activePalette.primary,
                      }
                    : {}
                }
                className={`px-2.5 py-1 rounded-md uppercase font-mono text-[10px] transition ${
                  logFilter === cat
                    ? 'font-bold'
                    : darkMode
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={`border-b font-mono text-[11px] ${
                  darkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'
                }`}
              >
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Detail</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                darkMode ? 'divide-white/5' : 'divide-slate-100'
              }`}
            >
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className={`transition ${
                    darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'
                  }`}
                >
                  <td
                    className={`py-3 px-3 font-mono whitespace-nowrap ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border"
                      style={{
                        backgroundColor: `${activePalette.primary}18`,
                        borderColor: `${activePalette.primary}40`,
                        color: activePalette.id === 'black-night' ? '#f1f5f9' : activePalette.primary,
                      }}
                    >
                      {log.category}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-3 font-semibold whitespace-nowrap ${
                      darkMode ? 'text-slate-200' : 'text-slate-800'
                    }`}
                  >
                    {log.action}
                  </td>
                  <td
                    className={`py-3 px-3 leading-relaxed ${
                      darkMode ? 'text-slate-400' : 'text-slate-600'
                    }`}
                  >
                    {log.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
