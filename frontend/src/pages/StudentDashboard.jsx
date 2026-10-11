import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Code, CheckCircle, XCircle, Brain, Timer, AlertTriangle, UserCheck } from 'lucide-react';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [allProblems, setAllProblems] = useState([]);
  const [code, setCode] = useState('#include <stdio.h>\n\nint main() {\n    long long a, b;\n    scanf("%lld %lld", &a, &b);\n    printf("%lld\\n", a + b);\n    return 0;\n}');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

// 1. Fetch Problem from DB on Load
  useEffect(() => {
    fetch('http://localhost:5000/api/problems')
      .then(res => res.json())
      .then(data => {
        if (data.length > 0) {
          setAllProblems(data); // Save the entire list
          setProblem(data[data.length - 1]); // Default to the newest problem added
        }
      })
      .catch(() => setError("Failed to load problem from database."));
  }, []);

  // 2. Submit & Poll Logic
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Step A: Submit Code
      const submitRes = await fetch('http://localhost:5000/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemId: problem.id, code })
      });
      const submitData = await submitRes.json();
      
      if (!submitRes.ok) throw new Error(submitData.error);

      // Step B: Polling for Agent Result (Every 2 seconds)
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        const pollRes = await fetch(`http://localhost:5000/api/submissions/${submitData.submissionId}`);
        const pollData = await pollRes.json();

        if (pollData.status === 'COMPLETED' || pollData.status === 'FAILED') {
          clearInterval(pollInterval);
          setResult(pollData);
          setLoading(false);
     } else if (attempts > 45) { // 45 attempts * 2s = 90 seconds timeout
          clearInterval(pollInterval);
          setError("Agent took too long to respond. Please check if Ollama is running.");
          setLoading(false);
        }
      }, 2000);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans p-6">
      {/* Header */}
      <header className="flex justify-between items-center pb-6 border-b border-gray-800 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">Student Workspace</h1>
          <p className="text-sm text-gray-400">Solve problems and get instant AI feedback</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors border border-gray-700">
          <LogOut size={16} /> Logout
        </button>
      </header>

    {/* Problem Selector Dropdown */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-gray-400 font-semibold">Select Problem:</label>
        <select 
          className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-72 p-2.5 outline-none cursor-pointer"
          value={problem ? problem.id : ''}
          onChange={(e) => {
            const selected = allProblems.find(p => p.id === e.target.value);
            setProblem(selected);
            setResult(null); // Clear previous results
          }}
        >
          {allProblems.map((p) => (
            <option key={p.id} value={p.id}>{p.title}</option>
          ))}
        </select>
      </div>

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: Problem & Editor */}
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

          <div className="flex-1 flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center gap-2">
              <Code size={18} className="text-blue-400" />
              <span className="font-semibold text-sm">main.c</span>
            </div>
            <textarea
              className="flex-1 w-full p-4 bg-transparent font-mono text-sm focus:outline-none resize-none text-gray-300"
              rows="16"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck="false"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !problem}
            className="py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Agents are reviewing your code...' : 'Submit to AutoGrader'}
          </button>
        </div>

        {/* Right Column: Agent Report */}
        <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col shadow-sm">
          <h2 className="text-xl font-bold text-gray-100 mb-6 border-b border-gray-800 pb-4">Agentic Evaluation Report</h2>
          
          {error && <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm mb-4">{error}</div>}
          
          {!result && !loading && !error && (
            <div className="flex-1 flex items-center justify-center text-gray-500 italic">
              Submit your code to see the detailed agent analysis.
            </div>
          )}

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-blue-400 font-medium animate-pulse">Running multiple AI agents...</p>
            </div>
          )}

          {result && result.status === 'COMPLETED' && result.report && (
            <div className="space-y-6 overflow-y-auto animate-fade-in pr-2">
              
              {/* Score Banner */}
              <div className="bg-gray-950 p-6 rounded-xl border border-gray-800 text-center">
                <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1">Final Score</p>
                <h3 className={`text-5xl font-extrabold ${result.finalScore >= 80 ? 'text-green-400' : result.finalScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {result.finalScore}<span className="text-2xl text-gray-600">/100</span>
                </h3>
              </div>

              {/* Dynamic Metrics Rendering */}
              {result.report.metrics.map((metric, idx) => {

                // 🚨 SPECIAL CASE: Compilation Error
                if (metric.name === 'compilation_error') {
                  return (
                    <div key={idx} className="space-y-4 animate-fade-in">
                      
                      {/* Raw GCC Error Box */}
                      <div className="bg-red-950/40 border border-red-900 rounded-lg p-4">
                        <h4 className="flex items-center gap-2 font-bold text-red-500 mb-2 border-b border-red-900/50 pb-2">
                          <XCircle size={18} /> Compilation Failed
                        </h4>
                        <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap overflow-x-auto p-2 bg-black/30 rounded">
                          {metric.details.rawError}
                        </pre>
                      </div>

                      {/* AI Hints Box */}
                      <div className="bg-orange-950/30 border border-orange-900/50 rounded-lg p-4">
                        <h4 className="flex items-center gap-2 font-semibold text-orange-400 mb-3">
                          <Brain size={18} /> AI Syntax Hints
                        </h4>
                        <ul className="list-disc list-inside space-y-2 text-sm text-gray-300 mb-4">
                          {metric.details.aiHints.map((hint, hIdx) => (
                            <li key={hIdx}>{hint}</li>
                          ))}
                        </ul>
                        <div className="text-sm italic text-orange-300/80 bg-orange-950/50 p-2 rounded border border-orange-900/30">
                          {metric.details.encouragement}
                        </div>
                      </div>
                      
                    </div>
                  );
                }
                
           // Logical Cases
                if (metric.name === 'logical') {
                  return (
                    <div key={idx} className="space-y-3">
                      <h4 className="flex items-center gap-2 font-semibold text-blue-300 text-lg border-b border-gray-800 pb-2">
                        <CheckCircle size={20} /> I/O Edge Cases ({metric.contribution} points)
                      </h4>
                      {metric.details.map((tc, tIdx) => (
                        <div key={tIdx} className={`p-3 rounded-lg border text-sm flex justify-between items-center ${tc.passed ? 'bg-green-950/30 border-green-900/50 text-green-300' : 'bg-red-950/30 border-red-900/50 text-red-300'}`}>
                          <span><span className="font-semibold capitalize">{tc.case}</span> Test</span>
                          <span>{tc.passed ? '✅ Passed' : `❌ Failed (Got: ${tc.got})`}</span>
                        </div>
                      ))}

                      {/* 🔥 NEW: AI DNA Tester & Counter Case Alert */}
                      {metric.aiFeedback && (
                        <div className="mt-4 p-4 bg-orange-950/30 border border-orange-900/50 rounded-lg animate-fade-in">
                          <h5 className="font-bold text-orange-400 mb-2 flex items-center gap-2">
                            <Brain size={16} /> AI Logic Hint & Counter Case
                          </h5>
                          <p className="text-sm text-gray-300 mb-3">{metric.aiFeedback.hint}</p>
                          
                          <div className="bg-black/40 p-3 rounded border border-orange-900/30 flex flex-col gap-1">
                            <p className="text-xs text-orange-300/80 uppercase font-bold tracking-wider mb-1">🚨 Counter Test Case</p>
                            <div className="flex gap-4 text-sm font-mono">
                              <div><span className="text-gray-500">Input:</span> <span className="text-blue-300">"{metric.aiFeedback.counter_case.input}"</span></div>
                              <div><span className="text-gray-500">Expected:</span> <span className="text-green-300">"{metric.aiFeedback.counter_case.expected}"</span></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                }

                // 🚨 SPECIAL CASE: AI Plagiarism Detector Flag
                if (metric.name === 'ai_detection') {
                  const { is_ai, confidence, reason } = metric.details;
                  return (
                    <div key={idx} className={`p-4 rounded-lg border mt-4 animate-fade-in ${is_ai ? 'bg-red-950/20 border-red-900/50' : 'bg-teal-950/20 border-teal-900/50'}`}>
                      <h4 className={`flex items-center gap-2 font-bold mb-2 ${is_ai ? 'text-red-400' : 'text-teal-400'}`}>
                        {is_ai ? (
                          <><AlertTriangle size={18} /> AI-Generated Code Flagged</>
                        ) : (
                          <><UserCheck size={18} /> Human-Written Code Verified</>
                        )}
                        <span className="text-xs font-normal opacity-70 px-2 py-0.5 bg-black/30 rounded-full">
                          {confidence}% Confidence
                        </span>
                      </h4>
                      <p className="text-sm text-gray-300">
                        <span className="font-semibold opacity-80">AI Analysis:</span> {reason}
                      </p>
                    </div>
                  );
                }
                
                // Readability (LLM)
                if (metric.name === 'readability') {
                  return (
                    <div key={idx} className="space-y-3">
                      <h4 className="flex items-center gap-2 font-semibold text-purple-400 text-lg border-b border-gray-800 pb-2">
                        <Brain size={20} /> AI Code Review ({metric.contribution.toFixed(2)} points)
                      </h4>
                      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
                        <p className="text-gray-300 leading-relaxed text-sm">
                          <span className="text-purple-400 font-semibold">Feedback: </span>
                          {metric.details.feedback}
                        </p>
                      </div>
                    </div>
                  )
                }

            // Complexity Estimator
if (metric.name === 'complexity') {
  return (
    <div key={idx} className="space-y-3">
      <h4 className="flex items-center gap-2 font-semibold text-yellow-400 text-lg border-b border-gray-800 pb-2">
        <Brain size={20} /> AI Time Complexity ({metric.contribution} points)
      </h4>
      <div className="bg-gray-950 p-4 rounded-lg border border-gray-800">
        <p className="text-gray-300 text-sm mb-2">
          <span className="text-yellow-400 font-semibold">Estimated: </span>
          <span className="font-mono bg-gray-900 px-2 py-1 rounded">{metric.details.estimated || "O(1)"}</span>
        </p>
        <p className="text-gray-300 leading-relaxed text-sm">
          <span className="text-yellow-400 font-semibold">AI Reason: </span>
          {metric.details.feedback}
        </p>
      </div>
    </div>
  )
}
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}