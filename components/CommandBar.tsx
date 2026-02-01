
import React, { useState } from 'react';
import { Terminal, Send } from 'lucide-react';
import { useStore } from '../store';
import { DrawingStatus } from '../types';

export const CommandBar: React.FC = () => {
  const [input, setInput] = useState('');
  const { activeProjectId, data, addRemark, deleteRemark, updateDrawing, batchUpdateDrawings, setFilterQuery } = useStore();
  const activeProject = data.projects.find(p => p.id === activeProjectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!activeProjectId || !activeProject) return;

    // 0. Global Filter Commands (No @ prefix needed)
    // Relaxed regex to allow spaces: "show : kevin"
    const filterMatch = trimmedInput.match(/^(show|ls)\s*[:：]\s*(.+)$/i);
    if (filterMatch) {
      const [, , query] = filterMatch;
      setFilterQuery(query.trim());
      setInput('');
      return;
    }

    if (/^(reset|clr|clear)$/i.test(trimmedInput)) {
      setFilterQuery('');
      setInput('');
      return;
    }

    if (!trimmedInput.startsWith('@')) return;

    // 1. Batch Status Update Detection (@R, @W, @A)
    const batchMatch = trimmedInput.match(/^@([RWA])\s+(.*)$/i);
    if (batchMatch) {
      const [, cmd, idString] = batchMatch;
      const statusMap: Record<string, DrawingStatus> = {
        'r': 'Reviewing', 'w': 'Waiting Reply', 'a': 'Approved'
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
      if (foundCount > 0) { setInput(''); return; }
    }

    // 2. Generic Multi-Target Command Parsing
    // Match @ID1,ID2... [Action]
    // Heuristic: Match everything starting with @ until the first space followed by a command indicator OR end of string.
    // If command indicator not found, assume remark content starts after first space logic? 
    // Wait, simpler: Split by space, check tokens? No.
    // Let's use the pattern: ^@(.+?)\s+(.*)$
    // Group 1 is ID list. Group 2 is command body.

    const genericMatch = trimmedInput.match(/^@(.+?)\s+(.*)$/);
    if (genericMatch) {
      const [, idPart, actionPart] = genericMatch;

      const targetIds = idPart.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
      const validDrawings = targetIds.map(id => activeProject.drawings.find(d =>
        d.customId.toLowerCase() === id.toLowerCase() ||
        d.drawingNo.toLowerCase() === id.toLowerCase() ||
        d.drawingNo.toLowerCase().includes(id.toLowerCase())
      )).filter((d): d is NonNullable<typeof d> => !!d);

      if (validDrawings.length > 0) {
        let actionHandled = false;

        // A. Comment Counts: c:10/2
        const commentMatch = actionPart.match(/^c[:：](\d+)\/(\d+)$/i);
        if (commentMatch) {
          const [, total, open] = commentMatch;
          validDrawings.forEach(d => updateDrawing(activeProjectId, d.id, {
            manualCommentsCount: parseInt(total),
            manualOpenCommentsCount: parseInt(open)
          }));
          actionHandled = true;
        }

        // B. Version/Round: v:3 or rd:A
        const overrideMatch = actionPart.match(/^(v|rd)[:：](.+)$/i);
        if (!actionHandled && overrideMatch) {
          const [, type, value] = overrideMatch;
          const updatePayload: any = {};
          if (type.toLowerCase() === 'v') updatePayload.version = value.trim();
          if (type.toLowerCase() === 'rd') updatePayload.currentRound = value.trim();
          validDrawings.forEach(d => updateDrawing(activeProjectId, d.id, updatePayload));
          actionHandled = true;
        }

        // B2. Due Date: due:2026-02-15 OR dl:02-15
        const dueMatch = actionPart.match(/^(due|dl)[:：](.+)$/i);
        if (!actionHandled && dueMatch) {
          const [, , val] = dueMatch;
          let dateStr = val.trim();
          // Simple heuristic for MM-DD or MM.DD implying current year
          if (/^\d{1,2}[-./]\d{1,2}$/.test(dateStr)) {
            dateStr = `${new Date().getFullYear()}-${dateStr.replace(/[.]/g, '-')}`;
          }

          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            validDrawings.forEach(d => updateDrawing(activeProjectId, d.id, { reviewDeadline: date.toISOString() }));
            actionHandled = true;
          } else {
            alert(`Invalid Date Format: ${val}`);
            // Don't clear input so user can fix
            return;
          }
        }

        // C. Tagging: #Tag or -#Tag
        const tagMatch = actionPart.match(/^(-?)#(.+)$/);
        if (!actionHandled && tagMatch) {
          const [, modifier, tagName] = tagMatch;
          const isRemove = modifier === '-';
          const fullTag = `#${tagName.trim()}`;
          validDrawings.forEach(d => {
            if (isRemove) deleteRemark(activeProjectId, d.id, fullTag);
            else addRemark(activeProjectId, d.id, fullTag);
          });
          actionHandled = true;
        }

        // E. Assignees: to:Name, add:Name, rm:Name
        const assignMatch = actionPart.match(/^(assign|to|add|plus|rm|drop)[:：]\s*(.+)$/i);
        if (!actionHandled && assignMatch) {
          const [, cmd, namesStr] = assignMatch;
          const names = namesStr.split(/[,，\s]+/).map(n => n.trim()).filter(Boolean);
          const command = cmd.toLowerCase();

          const updates = validDrawings.map(d => {
            let newAssignees = [...(d.assignees || [])];

            if (command === 'assign' || command === 'to') {
              newAssignees = names;
            } else if (command === 'add' || command === 'plus') {
              names.forEach(name => {
                if (!newAssignees.some(a => a.toLowerCase() === name.toLowerCase())) {
                  newAssignees.push(name);
                }
              });
            } else if (command === 'rm' || command === 'drop') {
              newAssignees = newAssignees.filter(a => !names.some(n => n.toLowerCase() === a.toLowerCase()));
            }
            return { id: d.id, changes: { assignees: newAssignees } };
          });

          batchUpdateDrawings(activeProjectId, updates);
          actionHandled = true;
        }

        // D. Default: Add Remark (if none of above matched, and it's not empty)
        // Ensure it's not a malformed command? No, treat as text.
        if (!actionHandled && actionPart.trim()) {
          validDrawings.forEach(d => addRemark(activeProjectId, d.id, actionPart.trim()));
          actionHandled = true;
        }

        if (actionHandled) {
          setInput('');
          return;
        }
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
