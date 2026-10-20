import { CheckCircle, XCircle, Brain, AlertTriangle, UserCheck, MessageSquare } from 'lucide-react';

export default function AgentReport({ result, loading, error }) {
  if (error) {
    return <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm mb-4">{error}</div>;
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-blue-400 font-medium animate-pulse">Running multiple AI agents...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 italic">
        Submit your code to see the detailed agent analysis.
      </div>
    );
  }

  return (
    <div className="space-y-6 overflow-y-auto pr-2 pb-4">
      
      {/* 🔥 FINAL SCORE (Rounded off) 🔥 */}
      <div className="bg-gray-950 p-6 rounded-xl border border-gray-800 text-center">
        <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-1">Final Score</p>
        <h3 className={`text-5xl font-extrabold ${result.finalScore >= 80 ? 'text-green-400' : result.finalScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
          {Math.round(result.finalScore)}<span className="text-2xl text-gray-600">/100</span>
        </h3>
      </div>

      {result.report.metrics.map((metric, idx) => {
        
        // 1. Compilation Error
        if (metric.name === 'compilation_error') {
          return (
            <div key={idx} className="space-y-4">
              <div className="bg-red-950/40 border border-red-900 rounded-lg p-4">
                <h4 className="flex items-center gap-2 font-bold text-red-500 mb-2 border-b border-red-900/50 pb-2">
                  <XCircle size={18} /> Compilation Failed
                </h4>
                <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap p-2 bg-black/30 rounded">{metric.details.rawError}</pre>
              </div>
              <div className="bg-orange-950/30 border border-orange-900/50 rounded-lg p-4">
                <h4 className="flex items-center gap-2 font-semibold text-orange-400 mb-3"><Brain size={18} /> AI Syntax Hints</h4>
                <ul className="list-disc list-inside space-y-2 text-sm text-gray-300 mb-4">
                  {metric.details.aiHints.map((hint, hIdx) => <li key={hIdx}>{hint}</li>)}
                </ul>
              </div>
            </div>
          );
        }

        // 2. Logical Cases & AI Hints
        if (metric.name === 'logical') {
          return (
            <div key={idx} className="space-y-3">
              <h4 className="flex items-center gap-2 font-semibold text-blue-300 text-lg border-b border-gray-800 pb-2">
                <CheckCircle size={20} /> I/O Edge Cases
              </h4>
              <div className="space-y-2">
                {metric.details.map((tc, tIdx) => (
                  <div key={tIdx} className={`p-3 rounded-lg border text-sm flex justify-between items-center ${tc.passed ? 'bg-green-950/30 border-green-900/50 text-green-300' : 'bg-red-950/30 border-red-900/50 text-red-300'}`}>
                    <span><span className="font-semibold capitalize">{tc.case}</span> Test</span>
                    <span>{tc.passed ? '✅ Passed' : `❌ Failed (Got: ${tc.got})`}</span>
                  </div>
                ))}
              </div>

              {/* 🔥 AI Counter Case Rendering 🔥 */}
              {metric.aiFeedback && (
                <div className="mt-4 p-4 bg-orange-950/30 border border-orange-900/50 rounded-lg">
                  <h5 className="font-bold text-orange-400 mb-2 flex items-center gap-2">
                    <Brain size={16} /> AI Logic Hint
                  </h5>
                  <p className="text-sm text-gray-300 mb-3">{metric.aiFeedback.hint}</p>
                  <div className="bg-black/40 p-3 rounded border border-orange-900/30">
                    <p className="text-xs text-orange-300 uppercase font-bold tracking-wider mb-1">🚨 Counter Test Case Generated</p>
                    <div className="flex gap-4 text-sm font-mono">
                      <div><span className="text-gray-500">Input:</span> <span className="text-blue-300">"{metric.aiFeedback.counter_case.input}"</span></div>
                      <div><span className="text-gray-500">Expected:</span> <span className="text-green-300">"{metric.aiFeedback.counter_case.expected}"</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }

        // 3. Complexity
        if (metric.name === 'complexity') {
            return (
              <div key={idx} className="bg-gray-950 p-4 rounded-lg border border-gray-800">
                <h4 className="flex items-center gap-2 font-semibold text-yellow-400 mb-2"><Brain size={18}/> Complexity Analysis</h4>
                <p className="text-gray-300 text-sm mb-1">Estimated: <span className="font-mono bg-gray-900 px-2 py-1 rounded text-yellow-300">{metric.details.estimated}</span></p>
                <p className="text-gray-400 text-xs">{metric.details.feedback}</p>
              </div>
            );
        }

        // 4. 🔥 Readability / Code Review 🔥
        if (metric.name === 'readability') {
            return (
              <div key={idx} className="bg-gray-950 p-4 rounded-lg border border-gray-800">
                <h4 className="flex items-center gap-2 font-semibold text-purple-400 mb-2">
                  <MessageSquare size={18} /> AI Code Review
                </h4>
                <p className="text-gray-300 text-sm leading-relaxed">{metric.details.feedback}</p>
              </div>
            );
        }

        // 5. 🔥 AI Detection / Plagiarism 🔥
        if (metric.name === 'ai_detection') {
            const { is_ai, confidence, reason } = metric.details;
            return (
              <div key={idx} className={`p-4 rounded-lg border mt-4 ${is_ai ? 'bg-red-950/20 border-red-900/50' : 'bg-teal-950/20 border-teal-900/50'}`}>
                <h4 className={`flex items-center gap-2 font-bold mb-2 ${is_ai ? 'text-red-400' : 'text-teal-400'}`}>
                  {is_ai ? <AlertTriangle size={18} /> : <UserCheck size={18} />}
                  {is_ai ? 'AI-Generated Code Flagged' : 'Human-Written Code Verified'}
                  <span className="text-xs font-normal opacity-70 px-2 py-0.5 bg-black/30 rounded-full ml-auto">
                    {confidence}% Confidence
                  </span>
                </h4>
                <p className="text-sm text-gray-300"><span className="font-semibold opacity-80">Analysis:</span> {reason}</p>
              </div>
            );
        }

        return null;
      })}
    </div>
  );
}