import { useState, useEffect } from 'react';
import { submissionAPI } from '../../api/services';
import { AlertTriangle, CheckCircle, XCircle, Clock, Filter, Bot, UserSearch } from 'lucide-react';

export default function SubmissionAnalytics() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('All');

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
              
              const aiMetric = sub.report?.metrics?.find(m => m.name === 'ai_detection');
              const aiConfidence = aiMetric?.details?.confidence || 0;
              const isAiFlagged = aiMetric?.details?.is_ai && aiConfidence >= 85; 

              return (
                <tr key={sub.id} className="hover:bg-gray-800/50 transition-colors">
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
                          <Bot size={14} /> AI Detected ({aiConfidence}%)
                        </span>
                      )}

                      {/* CLEAR STATUS */}
                      {!sub.isPlagiarized && !isAiFlagged && (
                        <span className="text-gray-600 text-xs">Clear</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}