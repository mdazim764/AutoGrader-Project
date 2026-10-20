import { useState, useEffect } from 'react';
import { submissionAPI } from '../../api/services';
import { AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function SubmissionAnalytics() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    submissionAPI.getAll()
      .then(res => {
        setSubmissions(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load submissions", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6 text-gray-400 animate-pulse">Loading Analytics Data...</div>;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-950/50">
        <h2 className="text-lg font-bold text-white">Live Submission Feed</h2>
        <span className="text-sm bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full border border-blue-800">
          Total: {submissions.length} Submissions
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-950 text-gray-400 uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-semibold">Student</th>
              <th className="px-6 py-4 font-semibold">Problem</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Attempt</th>
              <th className="px-6 py-4 font-semibold">Score</th>
              <th className="px-6 py-4 font-semibold text-center">Plagiarism Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {submissions.map((sub) => (
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
                <td className="px-6 py-4 text-center">
                  {sub.isPlagiarized ? (
                    <span className="inline-flex items-center gap-1 bg-red-900/30 text-red-400 px-2 py-1 rounded border border-red-800/50 text-xs font-semibold">
                      <AlertTriangle size={14} /> {sub.plagiarismScore}% Match
                    </span>
                  ) : (
                    <span className="text-gray-600 text-xs">Clear</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}