import { useState } from 'react';

function App() {
  // Pre-filled sample C code
  const [code, setCode] = useState('#include <stdio.h>\n\nint main() {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Calling our Node.js Backend API
      const response = await fetch('http://localhost:5000/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to evaluate code.');
      }
      
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
      <header className="mb-8 border-b border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-blue-400">Agentic AutoGrader</h1>
        <p className="text-gray-400 mt-2">Submit your C code for automated I/O testing and AI evaluation.</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Side: Code Editor */}
        <div className="flex-1 flex flex-col">
          <h2 className="text-xl mb-4 font-semibold text-gray-200">Code Editor</h2>
          <textarea
            className="flex-1 p-4 bg-gray-800 rounded-lg font-mono text-sm border border-gray-700 focus:outline-none focus:border-blue-500 shadow-inner"
            rows="22"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold disabled:opacity-50 transition-colors shadow-lg"
          >
            {loading ? 'Evaluating with Agents...' : 'Submit Code'}
          </button>
        </div>

        {/* Right Side: Evaluation Report */}
        <div className="flex-1 flex flex-col">
          <h2 className="text-xl mb-4 font-semibold text-gray-200">Evaluation Report</h2>
          <div className="flex-1 p-6 bg-gray-800 rounded-lg border border-gray-700 overflow-y-auto shadow-inner">
            
            {error && <p className="text-red-400 font-semibold p-4 bg-red-900/20 rounded">Error: {error}</p>}
            
            {!result && !error && !loading && (
              <p className="text-gray-400 flex h-full items-center justify-center italic">Waiting for submission...</p>
            )}
            
            {loading && (
              <div className="flex h-full items-center justify-center">
                <p className="text-blue-400 animate-pulse font-semibold text-lg">Running I/O tests & Ollama AI Review...</p>
              </div>
            )}
            
            {result && (
              <div className="animate-fade-in">
                {/* Score Banner */}
                <div className="mb-6 p-5 bg-gray-900 rounded-lg border border-gray-700 text-center shadow">
                  <h3 className="text-3xl font-bold text-green-400">Total Score: {result.total_grade} / {result.max_grade}</h3>
                </div>

                {/* Deterministic I/O Tests */}
                <h4 className="font-bold mb-3 text-lg text-blue-300 border-b border-gray-700 pb-2">I/O Correctness Tests</h4>
                <div className="space-y-3 mb-8">
                  {result.metrics?.correctness?.map((tc, idx) => (
                    <div key={idx} className={`p-4 rounded-md ${tc.passed ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
                      <p className="font-semibold text-gray-200">Test {tc.id}: {tc.description}</p>
                      <p className={`mt-1 font-mono text-sm ${tc.passed ? 'text-green-400' : 'text-red-400'}`}>
                        {tc.passed ? '✅ PASSED' : `❌ FAILED - ${tc.reason}`}
                      </p>
                    </div>
                  ))}
                </div>

                {/* AI Readability Review */}
                <h4 className="font-bold mb-3 text-lg text-yellow-300 border-b border-gray-700 pb-2">AI Code Review (Llama 3.1)</h4>
                <div className="p-5 bg-gray-900 rounded-md border border-gray-700 shadow">
                  <p className="text-lg"><span className="font-bold text-gray-400">Readability Score:</span> <span className="text-yellow-400 font-bold">{result.metrics?.readability?.score} / 10</span></p>
                  <p className="mt-3 text-gray-300 leading-relaxed"><span className="font-bold text-gray-400">Feedback:</span> {result.metrics?.readability?.feedback}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;