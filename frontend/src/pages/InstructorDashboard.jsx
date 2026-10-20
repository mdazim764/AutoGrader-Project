import { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import ProblemForm from '../components/instructor/ProblemForm';
import SubmissionAnalytics from '../components/instructor/SubmissionAnalytics';
import { CodeSquare, Activity } from 'lucide-react';

export default function InstructorDashboard() {
  const [activeTab, setActiveTab] = useState('manage'); // 'manage' | 'analytics'

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans p-6">
      <Navbar 
        title="Instructor Control Panel" 
        subtitle="Manage assignments and track student performance" 
      />

      {/* Tabs Navigation */}
      <div className="flex gap-4 border-b border-gray-800 pb-4 mb-6">
        <button 
          onClick={() => setActiveTab('manage')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all ${
            activeTab === 'manage' 
              ? 'bg-indigo-600 text-white shadow-lg' 
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-800'
          }`}
        >
          <CodeSquare size={18} /> Manage Problems
        </button>
        
        <button 
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all ${
            activeTab === 'analytics' 
              ? 'bg-indigo-600 text-white shadow-lg' 
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white border border-gray-800'
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
  );
}