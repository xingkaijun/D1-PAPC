import React, { useEffect } from 'react';
import { useStore } from '../store';
import { AlertCircle, Save, Database } from 'lucide-react';

export const UnsavedChangesIndicator: React.FC = () => {
  const hasUnsavedChanges = useStore(state => state.hasUnsavedChanges());
  const getUnsavedChangesCount = useStore(state => state.getUnsavedChangesCount());
  const saveProject = useStore(state => state.saveProject);
  const activeProjectId = useStore(state => state.activeProjectId);
  const isEditMode = useStore(state => state.isEditMode);
  const isLoading = useStore(state => state.isLoading);

  // Warn before closing/refreshing page if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSave = async () => {
    if (activeProjectId && isEditMode) {
      await saveProject(activeProjectId);
    }
  };

  if (!hasUnsavedChanges || !isEditMode) {
    return null;
  }

  const count = getUnsavedChangesCount;

  return (
    <div className="fixed bottom-6 right-6 z-[9000] animate-in slide-in-from-bottom-4 fade-in duration-500 no-print">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_24px_48px_-12px_rgba(15,118,110,0.3)] border-2 border-teal-200/60 overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center">
                <Database size={20} className="text-teal-600" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-teal-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {count}
              </span>
            </div>
            <div>
              <p className="text-sm font-[1000] uppercase tracking-wide leading-tight text-slate-800">
                Unsaved Changes
              </p>
              <p className="text-[10px] font-bold text-slate-500 mt-0.5 uppercase tracking-wider">
                {count} {count === 1 ? 'Item' : 'Items'} Pending
              </p>
            </div>
          </div>
          
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="ml-2 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-xl font-[1000] text-[10px] uppercase tracking-wider hover:from-teal-600 hover:to-teal-700 active:scale-95 transition-all shadow-lg shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} strokeWidth={2.5} />
            <span>Save Now</span>
          </button>
        </div>
        
        {/* Progress bar animation */}
        <div className="h-1 bg-gradient-to-r from-teal-100 to-teal-200 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-teal-400 to-teal-500 animate-pulse w-full" />
        </div>
      </div>
    </div>
  );
};
