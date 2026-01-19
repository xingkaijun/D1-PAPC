
import React, { useState } from 'react';
import { Terminal, Send } from 'lucide-react';
import { useStore } from '../store';
import { DrawingStatus } from '../types';

export const CommandBar: React.FC = () => {
  const [input, setInput] = useState('');
  const { activeProjectId, data, addRemark, updateDrawing } = useStore();
  const activeProject = data.projects.find(p => p.id === activeProjectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim().startsWith('@') || !activeProjectId || !activeProject) return;

    const trimmedInput = input.trim();

    // 1. Batch Status Update Detection (@R, @W, @A)
    const batchMatch = trimmedInput.match(/^@([RWA])\s+(.*)$/i);
    if (batchMatch) {
      const [, cmd, idString] = batchMatch;
      const statusMap: Record<string, DrawingStatus> = {
        'r': 'Reviewing',
        'w': 'Waiting Reply',
        'a': 'Approved'
      };
      const targetStatus = statusMap[cmd.toLowerCase()];
      const targetIds = idString.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);

      let foundCount = 0;
      targetIds.forEach(id => {
        const drawing = activeProject.drawings.find(d => 
          d.customId.toLowerCase() === id.toLowerCase() || 
          d.drawingNo.toLowerCase() === id.toLowerCase()
        );
        if (drawing) {
          updateDrawing(activeProjectId, drawing.id, { status: targetStatus });
          foundCount++;
        }
      });

      if (foundCount > 0) {
        setInput('');
        return;
      }
    }

    // 2. Official Comment Count Update Detection (@ID c:total/open)
    // Supports @ID c:10/2, @ID,c:10/2, @ID，c：10/2 etc.
    const commentUpdateMatch = trimmedInput.match(/^@([\w\d.-]+)[,，\s]*c[:：](\d+)\/(\d+)$/i);
    if (commentUpdateMatch) {
      const [, target, total, open] = commentUpdateMatch;
      const targetLower = target.toLowerCase();
      
      const drawing = activeProject.drawings.find(d => 
        d.customId.toLowerCase() === targetLower || 
        d.drawingNo.toLowerCase() === targetLower ||
        d.drawingNo.toLowerCase().includes(targetLower)
      );

      if (drawing) {
        updateDrawing(activeProjectId, drawing.id, { 
          manualCommentsCount: parseInt(total), 
          manualOpenCommentsCount: parseInt(open) 
        });
        setInput('');
        return;
      }
    }

    // 3. Standard Manual Remark Log (@Target Content)
    const remarkMatch = trimmedInput.match(/^@([\w\d.-]+)\s+(.*)$/);
    if (remarkMatch) {
      const [, target, content] = remarkMatch;
      const targetLower = target.toLowerCase();
      
      const drawing = activeProject.drawings.find(d => 
        d.customId.toLowerCase() === targetLower || 
        d.drawingNo.toLowerCase() === targetLower ||
        d.drawingNo.toLowerCase().includes(targetLower)
      );

      if (drawing) {
        addRemark(activeProjectId, drawing.id, content);
        setInput('');
      } else {
        alert(`Drawing with ID or No. "${target}" not found.`);
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto mb-6 sticky top-4 z-40 no-print">
      <form 
        onSubmit={handleSubmit}
        className="relative flex items-center bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden group focus-within:ring-2 ring-teal-500/20 transition-all"
      >
        <div className="pl-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" title="Command Input Mode">
          <Terminal size={18} />
        </div>
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Terminal: @001 [Remark] OR @001 c:12/3 (Comments) OR @R 001,002 (Status)"
          className="w-full py-3.5 px-4 outline-none text-slate-700 bg-transparent placeholder:text-slate-400 font-bold text-sm"
        />
        <button 
          type="submit"
          title="Execute Command"
          className="mr-2 p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
          disabled={!input.trim().startsWith('@')}
        >
          <Send size={16} />
        </button>
      </form>
      <div className="mt-2 text-[9px] text-slate-400 px-4 font-black uppercase tracking-widest flex gap-6 items-center flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-teal-600">@001 content</span>
          <span>Log Remark</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-teal-600">@001 c:11/1</span>
          <span>Update Comments (Total/Open)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-teal-600">@R 001,002...</span>
          <span>Batch Status (R, W, A)</span>
        </div>
      </div>
    </div>
  );
};
