import { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import ProblemForm from '../components/instructor/ProblemForm';
import SubmissionAnalytics from '../components/instructor/SubmissionAnalytics';
import { BarChart3, CodeSquare, Activity } from 'lucide-react';

export default function InstructorDashboard() {
  const [activeTab, setActiveTab] = useState('manage'); // 'manage' | 'analytics'

  return (
    <div className="min-h-screen bg-[#070b16] px-4 py-5 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
      <Navbar 
        title="Instructor Control Panel" 
        subtitle="Build assignments and monitor student progress." 
      />

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-5"><CodeSquare className="mb-4 text-indigo-300" /><p className="text-2xl font-bold text-white">Problems</p><p className="mt-1 text-sm text-slate-400">Create and tune coding assignments</p></div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-5"><BarChart3 className="mb-4 text-cyan-300" /><p className="text-2xl font-bold text-white">Analytics</p><p className="mt-1 text-sm text-slate-400">Review scores and submission signals</p></div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5"><Activity className="mb-4 text-emerald-300" /><p className="text-2xl font-bold text-white">Live grading</p><p className="mt-1 text-sm text-slate-400">Track the classroom feedback loop</p></div>
      </section>

      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-2 shadow-xl shadow-black/10">
        <button 
          onClick={() => setActiveTab('manage')}
          className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === 'manage' 
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <CodeSquare size={18} /> Manage Problems
        </button>
        
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all ${
            activeTab === 'analytics' 
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Activity size={18} /> Student Analytics
        </button>
      </div>

      {/* Dynamic Tab Rendering */}
      <div className="animate-fade-in">
        {activeTab === 'manage' ? <ProblemForm /> : <SubmissionAnalytics />}
      </div>
      </div>
    </div>
  );
}