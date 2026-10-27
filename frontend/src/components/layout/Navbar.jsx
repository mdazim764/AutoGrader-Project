import { LogOut, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ title, subtitle }) {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'User';

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <header className="flex flex-col gap-5 border-b border-slate-800/80 pb-6 mb-8 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-xl bg-indigo-500/15 p-2 text-indigo-300 ring-1 ring-indigo-400/20">
          <Sparkles size={20} />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Agentic AutoGrader</p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-sm text-slate-300 shadow-sm">
          Hi, <span className="font-semibold text-white">{userName}</span>
        </span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </header>
  );
}