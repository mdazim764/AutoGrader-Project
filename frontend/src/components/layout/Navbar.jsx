import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ title, subtitle }) {
  const navigate = useNavigate();
  const userName = localStorage.getItem('userName') || 'User';

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <header className="flex justify-between items-center pb-6 border-b border-gray-800 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-400">{title}</h1>
        <p className="text-sm text-gray-400">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-300 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-700">
          Hi, <span className="font-semibold text-white">{userName}</span>
        </span>
        <button 
          onClick={handleLogout} 
          className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-sm transition-colors border border-red-900/50"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </header>
  );
}