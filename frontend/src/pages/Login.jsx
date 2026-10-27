import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Mail, Lock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Save token and user details in browser
      localStorage.setItem('token', data.token);
      localStorage.setItem('userRole', data.user.role);
      localStorage.setItem('userName', data.user.name);

      // Redirect based on backend role
      if (data.user.role === 'INSTRUCTOR') {
        navigate('/instructor');
      } else {
        navigate('/student');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070b16] p-4 font-sans">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/40 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-600 via-violet-600 to-slate-950 p-10 lg:flex">
          <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-100">Agentic AutoGrader</p><h1 className="mt-8 max-w-md text-4xl font-bold leading-tight text-white">Make every submission a learning moment.</h1><p className="mt-5 max-w-md leading-7 text-indigo-100/80">Compile, test, and understand your code with structured feedback designed for the classroom.</p></div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-indigo-50">Deterministic tests. Actionable feedback. Better learning.</div>
        </div>
        <div className="p-7 text-center sm:p-10">
        <Code2 className="mx-auto mb-6 h-14 w-14 text-indigo-400" />
        <h1 className="text-3xl font-bold text-white">Welcome back</h1>
        <p className="mb-8 mt-2 text-slate-400">Sign in to continue to your workspace</p>
        
        {error && (
          <div className="mb-6 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input 
              type="email" 
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pl-10 pr-4 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input 
              type="password" 
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pl-10 pr-4 text-white outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
              required
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl bg-indigo-500 py-3 font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}