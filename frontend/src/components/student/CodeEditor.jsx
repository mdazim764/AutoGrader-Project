import { Code } from 'lucide-react';

export default function CodeEditor({ code, setCode }) {
  return (
    <div className="flex-1 flex flex-col bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <Code size={18} className="text-blue-400" />
        <span className="font-semibold text-sm">main.c</span>
      </div>
      <textarea
        className="flex-1 w-full p-4 bg-transparent font-mono text-sm focus:outline-none resize-none text-gray-300"
        rows="16"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck="false"
      />
    </div>
  );
}