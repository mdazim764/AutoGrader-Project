import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Save, Trash2, Database, Edit3 } from 'lucide-react';

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [allProblems, setAllProblems] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [timeLimit, setTimeLimit] = useState(1);
  const [memoryLimit, setMemoryLimit] = useState(64);
  const [complexity, setComplexity] = useState('O(1)'); // ✅ New Complexity State
  const [testCases, setTestCases] = useState([{ case: 'basic', input: '', expected: '' }]);

  // Fetch all problems on load
  useEffect(() => {
    fetch('http://localhost:5000/api/problems')
      .then(res => res.json())
      .then(data => setAllProblems(data))
      .catch(err => console.error("Failed to load problems", err));
  }, []);

  const handleSelectProblem = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    setMessage('');
    
    if (!id) {
      setTitle(''); setStatement(''); setTimeLimit(1); setMemoryLimit(64); setComplexity('O(1)');
      setTestCases([{ case: 'basic', input: '', expected: '' }]);
      return;
    }

    const p = allProblems.find(x => x.id === id);
    setTitle(p.title);
    setStatement(p.statement);
    setTimeLimit(p.timeLimitSec);
    setMemoryLimit(p.memoryLimitMb);
    
    let rulesObj = p.rules;
    
    // Deeply parse the JSON object returned from Supabase
    try {
      if (typeof rulesObj === 'string') {
        rulesObj = JSON.parse(rulesObj);
      }
      
      // Additional safety check: If metrics inside rules is a string
      if (rulesObj?.metrics && typeof rulesObj.metrics === 'string') {
         rulesObj.metrics = JSON.parse(rulesObj.metrics);
      }
    } catch(err) { 
      console.error("Deep JSON Parse Error", err); 
    }

    // Load Complexity safely
    const compRule = rulesObj?.metrics?.find(m => m.name === 'complexity');
    if (compRule && compRule.params?.required) {
      setComplexity(compRule.params.required);
    } else {
      setComplexity('O(1)');
    }
    
    // Load Logical Cases safely - checking for both 'cases' and 'testCases' 
    const logicalRule = rulesObj?.metrics?.find(m => m.name === 'logical');
    
    if (logicalRule?.params?.cases && Array.isArray(logicalRule.params.cases) && logicalRule.params.cases.length > 0) {
      setTestCases(logicalRule.params.cases);
    } else if (logicalRule?.params?.testCases && Array.isArray(logicalRule.params.testCases) && logicalRule.params.testCases.length > 0) {
      setTestCases(logicalRule.params.testCases);
    } else {
      setTestCases([{ case: 'basic', input: '', expected: '' }]);
    }
  };

  const handleAddTestCase = () => setTestCases([...testCases, { case: 'custom', input: '', expected: '' }]);
  const handleRemoveTestCase = (index) => setTestCases(testCases.filter((_, i) => i !== index));
  const handleChangeTestCase = (index, field, value) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const payload = {
      title, statement,
      timeLimitSec: Number(timeLimit),
      memoryLimitMb: Number(memoryLimit),
      rules: {
        metrics: [
          { name: "logical", weight: 0.40, params: { cases: testCases } },
          { name: "readability", weight: 0.20, params: { model: "llama3.1:8b", temperature: 0 } },
          { name: "complexity", weight: 0.40, params: { required: complexity } } // ✅ Dynamic Complexity Mapping
        ]
      }
    };

    const method = selectedId ? 'PUT' : 'POST';
    const url = selectedId ? `http://localhost:5000/api/problems/${selectedId}` : 'http://localhost:5000/api/problems';

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error("Failed to save problem");
      
      setMessage(`✅ Problem successfully ${selectedId ? 'updated' : 'created'}!`);
      
      if (!selectedId) {
        fetch('http://localhost:5000/api/problems')
          .then(res => res.json())
          .then(data => setAllProblems(data));
      }
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans p-6">
      <header className="flex justify-between items-center pb-6 border-b border-gray-800 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-indigo-400">Instructor Control Panel</h1>
          <p className="text-sm text-gray-400">Create or edit assignments</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm border border-gray-700">
          <LogOut size={16} /> Logout
        </button>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center gap-4">
          <Edit3 className="text-indigo-400" />
          <div className="flex-1">
            <label className="text-sm text-gray-400 block mb-1">Mode: Create New or Edit Existing?</label>
            <select 
              className="w-full bg-gray-950 border border-gray-700 text-white rounded p-2 focus:border-indigo-500 outline-none"
              value={selectedId}
              onChange={handleSelectProblem}
            >
              <option value="">✨ -- Create New Problem -- ✨</option>
              {allProblems.map(p => (
                <option key={p.id} value={p.id}>Edit: {p.title}</option>
              ))}
            </select>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 space-y-4">
            <h2 className="text-lg font-semibold border-b border-gray-800 pb-2 flex items-center gap-2">
              <Database size={18} className="text-indigo-400"/> General Information
            </h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Problem Title</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} type="text" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Problem Statement</label>
              <textarea required value={statement} onChange={(e) => setStatement(e.target.value)} rows="3" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none resize-none"></textarea>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Time Limit (sec)</label>
                <input required value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} type="number" min="1" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Memory Limit (MB)</label>
                <input required value={memoryLimit} onChange={(e) => setMemoryLimit(e.target.value)} type="number" min="16" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 focus:border-indigo-500 outline-none" />
              </div>
              {/* ✅ Target Complexity Dropdown added for Instructor */}
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Target Time Complexity</label>
                <select value={complexity} onChange={(e) => setComplexity(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none text-sm">
                  <option value="O(1)">O(1) - Constant</option>
                  <option value="O(log N)">O(log N) - Logarithmic</option>
                  <option value="O(N)">O(N) - Linear</option>
                  <option value="O(N log N)">O(N log N) - Linearithmic</option>
                  <option value="O(N^2)">O(N^2) - Quadratic</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <h2 className="text-lg font-semibold">Logical AI Test Cases</h2>
              <button type="button" onClick={handleAddTestCase} className="text-sm flex items-center gap-1 bg-gray-800 px-3 py-1 rounded text-indigo-300">
                <Plus size={14} /> Add Case
              </button>
            </div>
            {testCases.map((tc, idx) => (
              <div key={idx} className="flex items-start gap-4 bg-gray-950 p-4 rounded-lg border border-gray-800">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Case Name</label>
                  <input required value={tc.case} onChange={(e) => handleChangeTestCase(idx, 'case', e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 focus:border-indigo-500 outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Input</label>
                  <input required value={tc.input} onChange={(e) => handleChangeTestCase(idx, 'input', e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 focus:border-indigo-500 outline-none font-mono" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Expected</label>
                  <input required value={tc.expected} onChange={(e) => handleChangeTestCase(idx, 'expected', e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 focus:border-indigo-500 outline-none font-mono" />
                </div>
                {testCases.length > 1 && (
                  <button type="button" onClick={() => handleRemoveTestCase(idx)} className="mt-6 text-red-400 hover:text-red-300">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white shadow-md flex justify-center gap-2 disabled:opacity-50">
            {loading ? 'Saving...' : <><Save size={20} /> {selectedId ? 'Update Problem' : 'Deploy New Problem'}</>}
          </button>
          
          {message && (
            <div className={`p-4 rounded-lg text-center font-semibold border ${message.includes('✅') ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-red-900/30 text-red-400 border-red-800'}`}>
              {message}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}