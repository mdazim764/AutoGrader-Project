import { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import CodeEditor from '../components/student/CodeEditor';
import AgentReport from '../components/student/AgentReport';
import { problemAPI, submissionAPI } from '../api/services';
import { Play } from 'lucide-react';

export default function StudentDashboard() {
  const [problem, setProblem] = useState(null);
  const [allProblems, setAllProblems] = useState([]);
  const [code, setCode] = useState('#include <stdio.h>\n\nint main() {\n    long long a, b;\n    scanf("%lld %lld", &a, &b);\n    printf("%lld\\n", a + b);\n    return 0;\n}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        const res = await problemAPI.getAll();
        if (res.data.length > 0) {
          setAllProblems(res.data);
          setProblem(res.data[res.data.length - 1]);
        }
      } catch (err) {
        setError("Failed to load problem from database.");
      }
    };
    fetchProblems();
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const submitRes = await submissionAPI.submitCode({ problemId: problem.id, code });
      const submissionId = submitRes.data.submissionId;

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await submissionAPI.getReport(submissionId);
          const pollData = pollRes.data;

          if (pollData.status === 'COMPLETED' || pollData.status === 'FAILED') {
            clearInterval(pollInterval);
            setResult(pollData);
            setLoading(false);
          } else if (attempts > 45) { 
            clearInterval(pollInterval);
            setError("Agent took too long to respond. Please check if backend/Ollama is running.");
            setLoading(false);
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          setError(pollErr.response?.data?.error || "Error fetching report");
          setLoading(false);
        }
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans p-6">
      <Navbar title="Student Workspace" subtitle="Solve problems and get instant AI feedback" />

      {/* 🔥 NEW: Action Bar (Dropdown + Submit Button Together) 🔥 */}
      <div className="mb-6 flex flex-wrap justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <label className="text-gray-400 font-semibold">Select Problem:</label>
          <select 
            className="bg-gray-950 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 p-2.5 outline-none cursor-pointer"
            value={problem ? problem.id : ''}
            onChange={(e) => {
              const selected = allProblems.find(p => p.id === e.target.value);
              setProblem(selected);
              setResult(null); 
            }}
          >
            {allProblems.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !problem}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> AI Reviewing...</>
          ) : (
            <><Play size={18} /> Submit to AutoGrader</>
          )}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Problem & Code */}
        <div className="flex-1 flex flex-col gap-4">
          {problem ? (
            <div className="bg-gray-900 p-5 rounded-xl border border-gray-800 shadow-sm">
              <h2 className="text-xl font-bold text-gray-100 mb-2">{problem.title}</h2>
              <p className="text-gray-300 text-sm mb-4 leading-relaxed">{problem.statement}</p>
              <div className="flex gap-4 text-xs text-gray-400">
                <span className="bg-gray-800 px-3 py-1 rounded border border-gray-700">Time Limit: {problem.timeLimitSec}s</span>
                <span className="bg-gray-800 px-3 py-1 rounded border border-gray-700">Memory Limit: {problem.memoryLimitMb}MB</span>
              </div>
            </div>
          ) : (
            <div className="p-4 text-gray-400 italic bg-gray-900 rounded-xl border border-gray-800">Loading problem...</div>
          )}

          <CodeEditor code={code} setCode={setCode} />
        </div>

        {/* Right Column: Agent Report */}
        <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col shadow-sm">
          <h2 className="text-xl font-bold text-gray-100 mb-6 border-b border-gray-800 pb-4">
            Agentic Evaluation Report
          </h2>
          <AgentReport result={result} loading={loading} error={error} />
        </div>
      </div>
    </div>
  );
}