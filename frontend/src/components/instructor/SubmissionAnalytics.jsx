import { Fragment, useState, useEffect } from 'react';
import { submissionAPI } from '../../api/services';
import { AlertTriangle, CheckCircle, XCircle, Clock, Filter, Bot, UserSearch } from 'lucide-react';

export default function SubmissionAnalytics() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  useEffect(() => {
    submissionAPI.getAll().then(res => {
      setSubmissions(res.data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6 text-gray-400 animate-pulse">Loading Analytics Data...</div>;

  const uniqueProblems = [...new Set(submissions.map(s => s.problem?.title))];
  
  const filteredSubmissions = selectedFilter === 'All' 
    ? submissions 
    : submissions.filter(s => s.problem?.title === selectedFilter);

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-950/50">
        <h2 className="text-lg font-bold text-white">Live Submission Feed</h2>
        
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-gray-400"/>
          <select 
            className="bg-gray-950 border border-gray-700 text-sm rounded-lg p-2 text-white outline-none focus:border-blue-500"
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
          >
            <option value="All">All Problems</option>
            {uniqueProblems.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-950 text-gray-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-semibold">Student</th>
              <th className="px-6 py-4 font-semibold">Problem</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-center">Attempt</th>
              <th className="px-6 py-4 font-semibold">Score</th>
              <th className="px-6 py-4 font-semibold text-center">Flags (AI / Peer)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredSubmissions.map((sub) => {
              
              const aiMetric = sub.report?.metrics?.find(m => ['ai_detection', 'originality'].includes(m.name));
              const aiEvidence = aiMetric?.evidence || aiMetric?.details || {};
              const aiConfidence = aiEvidence.confidence || 0;
              const isAiFlagged = aiEvidence.is_ai || aiEvidence.flagged;

              return (
                <Fragment key={sub.id}>
                <tr key={sub.id} onClick={() => setSelectedSubmission(selectedSubmission?.id === sub.id ? null : sub)} className="cursor-pointer hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white">{sub.student?.name}</div>
                    <div className="text-xs text-gray-500">{sub.student?.email}</div>
                  </td>
                  <td className="px-6 py-4">{sub.problem?.title}</td>
                  <td className="px-6 py-4">
                    {sub.status === 'COMPLETED' ? (
                      <span className="flex items-center gap-1 text-green-400"><CheckCircle size={14}/> Graded</span>
                    ) : sub.status === 'FAILED' ? (
                      <span className="flex items-center gap-1 text-red-400"><XCircle size={14}/> Failed</span>
                    ) : (
                      <span className="flex items-center gap-1 text-yellow-400"><Clock size={14}/> Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-gray-800 px-2 py-1 rounded text-gray-300 text-xs font-mono">#{sub.attemptNumber}</span>
                  </td>
                  <td className="px-6 py-4 font-bold text-white">
                    {sub.finalScore !== null ? `${Math.round(sub.finalScore)}/100` : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center gap-2">
                      
                      {/* 🔥 PEER PLAGIARISM FLAG (UPDATED) 🔥 */}
                      {sub.isPlagiarized && (
                        <div className="flex flex-col items-center w-full">
                          <span className="flex items-center gap-1 bg-red-900/30 text-red-400 px-2 py-1 rounded border border-red-800/50 text-xs font-semibold w-full justify-center">
                            <AlertTriangle size={14} /> Peer Copy ({sub.plagiarismScore}%)
                          </span>
                          {/* Niche copied student ka naam dikhayega */}
                          {sub.matchedWith?.student?.name && (
                            <span className="text-[11px] text-red-300/80 mt-1 flex items-center gap-1">
                              <UserSearch size={12} /> Matched: {sub.matchedWith.student.name}
                            </span>
                          )}
                        </div>
                      )}

                      {/* AI GENERATION FLAG */}
                      {isAiFlagged && (
                        <span className="flex items-center gap-1 bg-purple-900/30 text-purple-400 px-2 py-1 rounded border border-purple-800/50 text-xs font-semibold w-full justify-center">
                          <Bot size={14} /> Review signal {aiConfidence ? `(${aiConfidence}%)` : ''}
                        </span>
                      )}

                      {/* CLEAR STATUS */}
                      {!sub.isPlagiarized && !isAiFlagged && (
                        <span className="text-gray-600 text-xs">Clear</span>
                      )}
                    </div>
                  </td>
                </tr>
                {selectedSubmission?.id === sub.id && (
                  <tr key={`${sub.id}-details`} className="border-b border-indigo-900/40 bg-slate-950/80">
                    <td colSpan="6" className="px-6 py-5">
                      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Report evidence</p>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <span className="rounded-lg bg-gray-900 p-3 text-gray-400">Status<strong className="mt-1 block text-white">{sub.status}</strong></span>
                            <span className="rounded-lg bg-gray-900 p-3 text-gray-400">Score<strong className="mt-1 block text-white">{sub.finalScore == null ? '—' : `${Math.round(sub.finalScore)}/100`}</strong></span>
                            <span className="rounded-lg bg-gray-900 p-3 text-gray-400">Flags<strong className="mt-1 block text-amber-300">{sub.report?.flags?.length || 0}</strong></span>
                            <span className="rounded-lg bg-gray-900 p-3 text-gray-400">Schema<strong className="mt-1 block text-white">{sub.report?.schema_version || 'legacy'}</strong></span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Metric breakdown</p>
                          <div className="mt-3 space-y-2">
                            {(sub.report?.metrics || []).map((metric) => (
                              <div key={metric.name} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-xs">
                                <span className="capitalize text-gray-300">{String(metric.name).replace(/_/g, ' ')}</span>
                                <span className="text-gray-400">{metric.status || '—'} · {metric.score == null ? 'N/A' : `${Math.round(metric.score * 100)}%`} · contribution {metric.contribution == null ? 'N/A' : Math.round(metric.contribution)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      {sub.report?.flags?.length > 0 && <p className="mt-4 text-xs text-amber-300">Flags: {sub.report.flags.join(', ')}</p>}
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}