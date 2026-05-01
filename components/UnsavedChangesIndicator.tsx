import React, { useEffect } from 'react';
import { useStore } from '../store';
import { AlertCircle, Save } from 'lucide-react';

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
        e.returnValue = '您有未保存的更改，确定要离开吗？';
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
    <div className="fixed bottom-6 right-6 z-[9000] animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl shadow-2xl border-2 border-white/20 backdrop-blur-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <AlertCircle size={24} className="animate-pulse" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping" />
            </div>
            <div>
              <p className="text-sm font-[1000] uppercase tracking-wide leading-tight">
                未保存的更改
              </p>
              <p className="text-xs font-bold opacity-90 mt-0.5">
                {count} 项待保存
              </p>
            </div>
          </div>
          
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="ml-4 flex items-center gap-2 px-4 py-2.5 bg-white text-orange-600 rounded-xl font-[1000] text-xs uppercase tracking-wider hover:bg-orange-50 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            <span>立即保存</span>
          </button>
        </div>
        
        {/* Progress bar animation */}
        <div className="h-1 bg-white/20 overflow-hidden">
          <div className="h-full bg-white/60 animate-pulse w-full" />
        </div>
      </div>
    </div>
  );
};
