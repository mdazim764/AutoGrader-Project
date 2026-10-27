import { Code, FileCode2, Upload } from 'lucide-react';

export default function CodeEditor({ code, setCode, onFileLoad }) {
  const handleFileChange = (event) => {
    const [file] = event.target.files;
    if (file) onFileLoad(file);
    event.target.value = '';
  };

  return (
    <div className="flex min-h-[600px] flex-1 flex-col overflow-hidden rounded-2xl border border-indigo-400/20 bg-slate-950 shadow-xl shadow-black/30 xl:min-h-[680px]">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <Code size={18} className="text-indigo-300" />
          <span className="text-sm font-semibold text-slate-200">main.c</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-indigo-400 hover:text-white">
            <Upload size={14} /> Open .c file
            <input type="file" accept=".c,text/x-c,text/plain" className="hidden" onChange={handleFileChange} />
          </label>
          <span className="flex items-center gap-1.5 text-xs text-slate-500"><FileCode2 size={14} /> C11</span>
        </div>
      </div>
      <textarea
        aria-label="C source code editor"
        className="min-h-[390px] w-full flex-1 resize-none bg-transparent p-5 font-mono text-sm leading-6 text-slate-200 outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-inset focus:ring-indigo-500/40"
        rows="20" // 🔥 Changed from 16 to 20 for more space
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck="false"
      />
    </div>
  );
}