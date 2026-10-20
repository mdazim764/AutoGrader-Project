import { useState, useEffect } from 'react';
import { Plus, Save, Trash2, Database, Edit3 } from 'lucide-react';
import { problemAPI } from '../../api/services';

export default function ProblemForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [allProblems, setAllProblems] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [timeLimit, setTimeLimit] = useState(1);
  const [memoryLimit, setMemoryLimit] = useState(64);
  const [complexity, setComplexity] = useState('O(1)');
  const [testCases, setTestCases] = useState([{ case: 'basic', input: '', expected: '' }]);

  const loadProblems = () => {
    problemAPI.getAll().then(res => setAllProblems(res.data)).catch(console.error);
  };

  useEffect(() => { loadProblems(); }, []);

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
    
    try { 
      // Deep parsing: Supabase JSON ko string ki tarah return kar sakta hai
      if (typeof rulesObj === 'string') rulesObj = JSON.parse(rulesObj); 
      if (rulesObj?.metrics && typeof rulesObj.metrics === 'string') {
        rulesObj.metrics = JSON.parse(rulesObj.metrics);
      }
    } catch(err) {
      console.error("Parse Error:", err);
    }

    // Load Complexity
    const compRule = rulesObj?.metrics?.find(m => m.name === 'complexity');
    setComplexity(compRule?.params?.required || 'O(1)');
    
    // 🔥 FIX: Extracting Logical Cases safely
    const logicalRule = rulesObj?.metrics?.find(m => m.name === 'logical');
    
    if (logicalRule?.params?.cases && Array.isArray(logicalRule.params.cases)) {
      // Backend test cases return as objects { case: 'basic', input: '10', expected: '10' }
      // Humhe unko as it is set karna hai
      setTestCases(logicalRule.params.cases.map(tc => {
        return typeof tc === 'string' ? { case: tc, input: '', expected: '' } : tc;
      }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setMessage('');

    const payload = {
      title, statement, timeLimitSec: Number(timeLimit), memoryLimitMb: Number(memoryLimit),
      rules: {
        metrics: [
          { name: "logical", weight: 0.40, params: { cases: testCases } },
          { name: "readability", weight: 0.20, params: { model: "llama3.1:8b", temperature: 0 } },
          { name: "complexity", weight: 0.40, params: { required: complexity } }
        ]
      }
    };

    try {
      if (selectedId) {
        await problemAPI.update(selectedId, payload);
        setMessage('✅ Problem updated successfully!');
      } else {
        await problemAPI.create(payload);
        setMessage('✅ New problem deployed!');
        loadProblems(); // Refresh list
      }
    } catch (err) {
      setMessage(`❌ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center gap-4 shadow-sm">
        <Edit3 className="text-indigo-400" />
        <div className="flex-1">
          <label className="text-sm text-gray-400 block mb-1">Mode: Create New or Edit Existing?</label>
          <select value={selectedId} onChange={handleSelectProblem} className="w-full bg-gray-950 border border-gray-700 text-white rounded p-2 outline-none">
            <option value="">✨ -- Create New Problem -- ✨</option>
            {allProblems.map(p => <option key={p.id} value={p.id}>Edit: {p.title}</option>)}
          </select>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 space-y-4">
          <h2 className="text-lg font-semibold border-b border-gray-800 pb-2 flex items-center gap-2"><Database size={18} className="text-indigo-400"/> General Info</h2>
          <div><label className="block text-sm text-gray-400 mb-1">Title</label><input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 outline-none" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Statement</label><textarea required value={statement} onChange={e => setStatement(e.target.value)} rows="3" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 outline-none resize-none"></textarea></div>
          <div className="flex gap-4">
            <div className="flex-1"><label className="block text-sm text-gray-400 mb-1">Time (sec)</label><input required value={timeLimit} onChange={e => setTimeLimit(e.target.value)} type="number" min="1" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 outline-none" /></div>
            <div className="flex-1"><label className="block text-sm text-gray-400 mb-1">Memory (MB)</label><input required value={memoryLimit} onChange={e => setMemoryLimit(e.target.value)} type="number" min="16" className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 outline-none" /></div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Target Complexity</label>
              <select value={complexity} onChange={e => setComplexity(e.target.value)} className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 outline-none">
                <option value="O(1)">O(1) - Constant</option><option value="O(log N)">O(log N) - Logarithmic</option><option value="O(N)">O(N) - Linear</option><option value="O(N^2)">O(N^2) - Quadratic</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-800 pb-2">
            <h2 className="text-lg font-semibold">Test Cases</h2>
            <button type="button" onClick={handleAddTestCase} className="text-sm flex items-center gap-1 bg-gray-800 px-3 py-1 rounded text-indigo-300"><Plus size={14} /> Add Case</button>
          </div>
          {testCases.map((tc, idx) => (
            <div key={idx} className="flex gap-4 bg-gray-950 p-4 rounded-lg border border-gray-800">
              <div className="flex-1"><input placeholder="Name" required value={tc.case} onChange={e => handleChangeTestCase(idx, 'case', e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 outline-none" /></div>
              <div className="flex-1"><input placeholder="Input" required value={tc.input} onChange={e => handleChangeTestCase(idx, 'input', e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 outline-none font-mono" /></div>
              <div className="flex-1"><input placeholder="Expected" required value={tc.expected} onChange={e => handleChangeTestCase(idx, 'expected', e.target.value)} type="text" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-1.5 outline-none font-mono" /></div>
              {testCases.length > 1 && <button type="button" onClick={() => handleRemoveTestCase(idx)} className="text-red-400"><Trash2 size={18} /></button>}
            </div>
          ))}
        </div>
        <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white shadow-md flex justify-center gap-2">
          {loading ? 'Saving...' : <><Save size={20} /> {selectedId ? 'Update Problem' : 'Deploy New Problem'}</>}
        </button>
        {message && <div className={`p-4 rounded-lg text-center font-semibold border ${message.includes('✅') ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-red-900/30 text-red-400 border-red-800'}`}>{message}</div>}
      </form>
    </div>
  );
}