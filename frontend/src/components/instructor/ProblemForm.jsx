import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, FileText, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { problemAPI } from '../../api/services';

const generatedCases = {
  basic: { input: '10 20', expected: '30' },
  zero: { input: '0 0', expected: '0' },
  negatives: { input: '-50 -150', expected: '-200' },
  int_overflow: { input: '2147483647 1', expected: '-2147483648' },
};

const emptyCase = () => ({ case: 'custom', input: '', expected: '' });

function parseRules(value) {
  let rules = value;
  try {
    if (typeof rules === 'string') rules = JSON.parse(rules);
    if (typeof rules?.metrics === 'string') rules = { ...rules, metrics: JSON.parse(rules.metrics) };
  } catch {
    return {};
  }
  return rules || {};
}

function normalizeCase(value) {
  if (typeof value !== 'string') return { ...value, case: value.case || 'custom', input: value.input ?? '', expected: value.expected ?? '' };
  return { case: value, ...(generatedCases[value] || {}) };
}

export default function ProblemForm() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [allProblems, setAllProblems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [timeLimit, setTimeLimit] = useState(1);
  const [memoryLimit, setMemoryLimit] = useState(64);
  const [complexity, setComplexity] = useState('O(1)');
  const [testCases, setTestCases] = useState([emptyCase()]);

  const selectedProblem = useMemo(() => allProblems.find((problem) => problem.id === selectedId), [allProblems, selectedId]);

  const loadProblems = async () => {
    try {
      const { data } = await problemAPI.getAll();
      setAllProblems(data);
    } catch {
      setMessage({ type: 'error', text: 'Unable to load problems.' });
    }
  };

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { loadProblems(); }, []);

  const resetForm = () => {
    setSelectedId('');
    setTitle('');
    setStatement('');
    setTimeLimit(1);
    setMemoryLimit(64);
    setComplexity('O(1)');
    setTestCases([emptyCase()]);
    setMessage(null);
  };

  const handleSelectProblem = (event) => {
    const id = event.target.value;
    setSelectedId(id);
    setMessage(null);
    if (!id) {
      resetForm();
      return;
    }

    const problem = allProblems.find((item) => item.id === id);
    const rules = parseRules(problem?.rules);
    const metrics = Array.isArray(rules.metrics) ? rules.metrics : [];
    const logical = metrics.find((metric) => metric.name === 'logical');
    const complexityRule = metrics.find((metric) => metric.name === 'complexity');

    setTitle(problem?.title || '');
    setStatement(problem?.statement || '');
    setTimeLimit(problem?.timeLimitSec || 1);
    setMemoryLimit(problem?.memoryLimitMb || 64);
    setComplexity(complexityRule?.params?.required || 'O(1)');
    setTestCases(Array.isArray(logical?.params?.cases) && logical.params.cases.length
      ? logical.params.cases.map(normalizeCase)
      : [emptyCase()]);
  };

  const handleChangeTestCase = (index, field, value) => {
    setTestCases((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = {
      title: title.trim(),
      statement: statement.trim(),
      timeLimitSec: Number(timeLimit),
      memoryLimitMb: Number(memoryLimit),
      rules: {
        metrics: [
          { name: 'logical', weight: 0.4, params: { cases: testCases } },
          { name: 'readability', weight: 0.2, params: { model: 'llama3.1:8b', temperature: 0 } },
          { name: 'complexity', weight: 0.4, params: { required: complexity } },
        ],
      },
    };

    try {
      if (selectedId) {
        await problemAPI.update(selectedId, payload);
        setMessage({ type: 'success', text: 'Problem updated successfully.' });
      } else {
        await problemAPI.create(payload);
        setMessage({ type: 'success', text: 'New problem created successfully.' });
        await loadProblems();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Unable to save problem.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-gradient-to-r from-indigo-950/60 to-slate-900 p-6 shadow-xl shadow-black/10 md:flex-row md:items-center md:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Assignment studio</p><h2 className="mt-2 text-2xl font-bold">Design a coding challenge</h2><p className="mt-1 text-sm text-slate-400">Configure the statement, limits, rubric, and public examples.</p></div>
        <div className="flex items-center gap-3"><span className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300">{allProblems.length} problem{allProblems.length === 1 ? '' : 's'}</span><button type="button" onClick={resetForm} className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/20"><Plus size={15} className="mr-1 inline" /> New problem</button></div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-400">Editing mode</label>
        <select value={selectedId} onChange={handleSelectProblem} disabled={saving} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20">
          <option value="">Create a new problem</option>
          {allProblems.map((problem) => <option key={problem.id} value={problem.id}>Edit: {problem.title}</option>)}
        </select>
        {selectedProblem && <p className="mt-2 text-xs text-slate-500">Editing the saved version of <strong className="text-slate-300">{selectedProblem.title}</strong>. Test-case values are loaded from its logical rubric.</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-black/10">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-800 pb-4"><div className="rounded-xl bg-indigo-500/15 p-2 text-indigo-300"><FileText size={19} /></div><div><h3 className="font-bold">Problem content</h3><p className="text-xs text-slate-500">Give students a precise, actionable prompt.</p></div></div>
          <div className="space-y-4">
            <label className="block text-sm text-slate-300">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" placeholder="e.g. Add Two Integers Safely" /></label>
            <label className="block text-sm text-slate-300">Statement<textarea required value={statement} onChange={(event) => setStatement(event.target.value)} rows="5" className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 leading-6 text-white outline-none focus:border-indigo-400" placeholder="Describe the input, expected output, and constraints." /></label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-black/10">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-800 pb-4"><div className="rounded-xl bg-cyan-500/15 p-2 text-cyan-300"><Settings2 size={19} /></div><div><h3 className="font-bold">Execution rubric</h3><p className="text-xs text-slate-500">Set constraints used by the grader.</p></div></div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm text-slate-300">Time limit (seconds)<input required min="1" type="number" value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" /></label>
            <label className="block text-sm text-slate-300">Memory limit (MB)<input required min="16" type="number" value={memoryLimit} onChange={(event) => setMemoryLimit(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" /></label>
            <label className="block text-sm text-slate-300">Target complexity<select value={complexity} onChange={(event) => setComplexity(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400"><option>O(1)</option><option>O(log N)</option><option>O(N)</option><option>O(N^2)</option></select></label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-black/10">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300"><BookOpen size={19} /></div><div><h3 className="font-bold">Public test cases</h3><p className="text-xs text-slate-500">Students see these examples before submitting.</p></div></div><button type="button" onClick={() => setTestCases((current) => [...current, emptyCase()])} className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"><Plus size={15} className="mr-1 inline" /> Add test case</button></div>
          <div className="space-y-3">
            {testCases.map((testCase, index) => <div key={`${testCase.case}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Case {index + 1}</span><button type="button" onClick={() => setTestCases((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={testCases.length === 1} className="rounded-lg p-2 text-rose-400 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Remove test case ${index + 1}`}><Trash2 size={16} /></button></div><div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr_1.2fr]"><input required value={testCase.case} onChange={(event) => handleChangeTestCase(index, 'case', event.target.value)} placeholder="Case name" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400" /><textarea required value={testCase.input} onChange={(event) => handleChangeTestCase(index, 'input', event.target.value)} placeholder="Input" rows="2" className="resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm text-sky-200 outline-none focus:border-indigo-400" /><textarea required value={testCase.expected} onChange={(event) => handleChangeTestCase(index, 'expected', event.target.value)} placeholder="Expected output" rows="2" className="resize-y rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 font-mono text-sm text-emerald-200 outline-none focus:border-indigo-400" /></div></div>)}
          </div>
          <p className="mt-4 text-xs text-slate-500">Use the exact whitespace and line breaks expected from the program output.</p>
        </section>

        {message && <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${message.type === 'success' ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : 'border-rose-400/20 bg-rose-500/10 text-rose-300'}`}><CheckCircle2 size={17} />{message.text}</div>}
        <button type="submit" disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"><Save size={18} />{saving ? 'Saving problem...' : selectedId ? 'Update problem' : 'Create problem'}</button>
      </form>
    </div>
  );
}
