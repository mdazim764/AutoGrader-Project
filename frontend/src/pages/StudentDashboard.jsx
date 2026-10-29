import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '../components/layout/Navbar';
import CodeEditor from '../components/student/CodeEditor';
import AgentReport from '../components/student/AgentReport';
import { problemAPI, submissionAPI } from '../api/services';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Code2,
  Cpu,
  Play,
  Terminal,
  ChevronDown,
} from 'lucide-react';

const BASE_C_CODE = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    // Write your code logic here
    
    return 0;
}`;

const generatedCases = {
  basic: { input: '10 20', expected: '30' },
  zero: { input: '0 0', expected: '0' },
  negatives: { input: '-50 -150', expected: '-200' },
  int_overflow: { input: '2147483647 1', expected: '-2147483648' },
};

function getRules(problem) {
  let rules = problem?.rules;
  if (typeof rules === 'string') {
    try {
      rules = JSON.parse(rules);
    } catch {
      return {};
    }
    if (typeof rules?.metrics === 'string') {
      try {
        rules = { ...rules, metrics: JSON.parse(rules.metrics) };
      } catch {
        return {};
      }
    }
  }
  return rules || {};
}

function getTestCases(problem) {
  const rules = getRules(problem);
  const logical = rules?.metrics?.find((metric) => ['logical', 'edge_case_runner', 'io_tests'].includes(metric.name || metric.analyzer));
  const cases = Array.isArray(rules?.tests?.public) && rules.tests.public.length
    ? rules.tests.public
    : logical?.params?.cases;
  if (!Array.isArray(cases)) return [];

  return cases.map((testCase, index) => {
    if (typeof testCase === 'string') {
      return {
        case: testCase,
        ...(generatedCases[testCase] || {}),
        id: `${testCase}-${index}`,
      };
    }
    const generated = generatedCases[testCase.case] || {};
    return {
      ...generated,
      ...testCase,
      id: `${testCase.case || testCase.id || 'case'}-${index}`,
    };
  });
}

export default function StudentDashboard() {
  const [problem, setProblem] = useState(null);
  const [allProblems, setAllProblems] = useState([]);
  const [code, setCode] = useState(BASE_C_CODE);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [problemMenuOpen, setProblemMenuOpen] = useState(false);
  const pollRef = useRef(null);
  const problemMenuRef = useRef(null);

  useEffect(() => {
    let active = true;
    problemAPI.getAll()
      .then(({ data }) => {
        if (!active) return;
        setAllProblems(data);
        setProblem(data[data.length - 1] || null);
      })
      .catch(() => active && setError('Unable to load problems. Check the API connection.'))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    const closeMenu = (event) => {
      if (!problemMenuRef.current?.contains(event.target)) setProblemMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  const testCases = useMemo(() => getTestCases(problem), [problem]);
  const rules = useMemo(() => getRules(problem), [problem]);
  const complexity = rules.metrics?.find((metric) => metric.name === 'complexity')?.params?.required;

  const handleProblemChange = (event) => {
    const selected = allProblems.find(({ id }) => id === event.target.value);
    setProblem(selected || null);
    setProblemMenuOpen(false);
    setCode(BASE_C_CODE);
    setResult(null);
    setError(null);
    restoreLatestSubmission(selected);
  };

  const restoreLatestSubmission = async (selectedProblem = problem, showLoading = true) => {
    if (!selectedProblem) return;
    if (showLoading) setRestoring(true);
    try {
      const { data } = await submissionAPI.getLatest(selectedProblem.id);
      if (data?.code) setCode(data.code);
      if (data?.report || data?.status === 'COMPLETED' || data?.status === 'FAILED') {
        setResult(data);
      }
    } catch (restoreError) {
      if (restoreError.response?.status !== 404) {
        setError(restoreError.response?.data?.error || 'Unable to restore the latest submission.');
      }
    } finally {
      if (showLoading) setRestoring(false);
    }
  };

  const handleCodeFileLoad = (file) => {
    if (!file.name.toLowerCase().endsWith('.c')) {
      setError('Please choose a C source file with a .c extension.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCode(String(reader.result || ''));
      setResult(null);
      setError(null);
    };
    reader.onerror = () => setError('Unable to read the selected C source file.');
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!problem || !code.trim()) return;
    setGrading(true);
    setError(null);
    setResult(null);

    try {
      const { data } = await submissionAPI.submitCode({ problemId: problem.id, code });
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const response = await submissionAPI.getReport(data.submissionId);
          if (['COMPLETED', 'FAILED'].includes(response.data.status)) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setResult(response.data);
            setGrading(false);
          } else if (attempts >= 45) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            setError('Grading is taking longer than expected. You can refresh to check the report.');
            setGrading(false);
          }
        } catch (pollError) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setError(pollError.response?.data?.error || 'Unable to fetch the grading report.');
          setGrading(false);
        }
      }, 2000);
    } catch (submitError) {
      setError(submitError.response?.data?.error || submitError.message);
      setGrading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b16] px-4 py-5 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Navbar title="Student Workspace" subtitle="Practice, submit, and understand every result." />

        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Current assignment</p>
            <h2 className="mt-1 truncate text-lg font-bold text-white">{problem?.title || (loading ? 'Loading problem...' : 'No problem selected')}</h2>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <div className="relative min-w-0 sm:min-w-[250px]" ref={problemMenuRef}>
              <button type="button" aria-haspopup="listbox" aria-expanded={problemMenuOpen} onClick={() => setProblemMenuOpen((open) => !open)} disabled={loading || grading} className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-left text-sm text-white outline-none transition hover:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/30 disabled:cursor-not-allowed disabled:opacity-60">
                <Code2 size={18} className="shrink-0 text-indigo-300" />
                <span className="min-w-0 flex-1 truncate">{problem?.title || 'Select problem'}</span>
                <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${problemMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {problemMenuOpen && (
                <div role="listbox" className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl shadow-black/50">
                  {allProblems.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">No problems available</p> : allProblems.map((item) => (
                    <button type="button" role="option" aria-selected={item.id === problem?.id} key={item.id} onClick={() => handleProblemChange({ target: { value: item.id } })} className={`block w-full truncate rounded-lg px-3 py-2.5 text-left text-sm transition ${item.id === problem?.id ? 'bg-indigo-500/20 text-indigo-200' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                      {item.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => restoreLatestSubmission()} disabled={grading || loading || restoring || !problem} className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-indigo-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
              {restoring ? 'Loading...' : 'Load last submission'}
            </button>
            <button onClick={handleSubmit} disabled={grading || loading || !problem} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">
              {grading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Grading...</> : <><Play size={18} /> Submit solution</>}
            </button>
          </div>
        </section>

        {error && <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertCircle size={18} />{error}</div>}

        <main>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(340px,0.4fr)_minmax(0,0.6fr)]">
            <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-xl shadow-black/10">
              {problem ? (
                <>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Problem details</p>
                    <div className="flex gap-1.5 text-[11px]">
                      <span className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-300"><Clock3 size={12} className="text-amber-300" /> {problem.timeLimitSec}s</span>
                      <span className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-300"><Cpu size={12} className="text-cyan-300" /> {problem.memoryLimitMb}MB</span>
                    </div>
                  </div>
                  <h2 className="mb-3 text-xl font-bold">{problem.title}</h2>
                  <p className="whitespace-pre-wrap leading-7 text-slate-300">{problem.statement}</p>
                  {complexity && <div className="mt-4 flex items-center gap-2 rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200"><CheckCircle2 size={14} /> Target: <strong>{complexity}</strong></div>}
                </>
              ) : <p className="text-slate-400">{loading ? 'Loading problem...' : 'No problem selected.'}</p>}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-xl shadow-black/10">
              <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Examples</p><h3 className="mt-1 text-lg font-bold">Base test cases</h3></div><Terminal className="text-emerald-300" size={19} /></div>
              {testCases.length ? <div className="space-y-3">{testCases.map((testCase) => <div key={testCase.id} className="rounded-xl border border-slate-800 bg-slate-950/80 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{testCase.case || 'Example'}</p><div className="grid gap-2 font-mono text-xs"><div><span className="mr-2 font-sans uppercase text-slate-500">In:</span><span className="whitespace-pre-wrap text-sky-300">{testCase.input || 'Not provided'}</span></div><div><span className="mr-2 font-sans uppercase text-slate-500">Out:</span><span className="whitespace-pre-wrap text-emerald-300">{testCase.expected || 'Not provided'}</span></div></div></div>)}</div> : <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">No public examples configured.</p>}
              <p className="mt-4 text-xs text-slate-500">These examples are public. Additional hidden cases may affect your final score.</p>
            </section>
            </aside>
            <section className="min-w-0">
              <CodeEditor code={code} setCode={setCode} onFileLoad={handleCodeFileLoad} />
            </section>
          </div>

          <section className="relative mt-6 overflow-hidden rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 p-5 shadow-2xl shadow-black/20 sm:p-7">
            <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="relative mb-6 flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-300">Submission feedback</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Detailed evaluation</h2><p className="mt-1 text-sm text-slate-400">Review correctness, quality, and agent feedback in one place.</p></div>
              <span className={`w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${result?.status === 'COMPLETED' ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300' : result?.status === 'FAILED' ? 'border-rose-400/20 bg-rose-500/10 text-rose-300' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>{result ? result.status : 'Not submitted'}</span>
            </div>
            <div className="relative max-h-[720px] overflow-y-auto"><AgentReport result={result} loading={grading} error={null} /></div>
          </section>
        </main>
      </div>
    </div>
  );
}
