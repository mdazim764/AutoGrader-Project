import { useNavigate } from 'react-router-dom';
import { Code2, User, BookOpen } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();

  // Dummy login function
  const handleLogin = (role) => {
    localStorage.setItem('userRole', role); // Save role in browser
    if (role === 'INSTRUCTOR') navigate('/instructor');
    else navigate('/student');
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-8 text-center">
        <Code2 className="w-16 h-16 text-blue-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold text-white mb-2">Agentic AutoGrader</h1>
        <p className="text-gray-400 mb-8">Select your role to continue</p>
        
        <div className="space-y-4">
          <button 
            onClick={() => handleLogin('INSTRUCTOR')}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-semibold transition-all shadow-lg"
          >
            <BookOpen className="w-5 h-5" /> Login as Instructor
          </button>
          
          <button 
            onClick={() => handleLogin('STUDENT')}
            className="w-full flex items-center justify-center gap-3 bg-gray-800 hover:bg-gray-700 text-white py-3 border border-gray-700 rounded-lg font-semibold transition-all shadow-lg"
          >
            <User className="w-5 h-5" /> Login as Student
          </button>
        </div>
      </div>
    </div>
  );
}