// ============================================================================
// Note / Lore Document Modal Component
// ============================================================================

import React from 'react';
import { useGameStore } from '../state/store';

export const NoteModal: React.FC = () => {
  const activeNote = useGameStore((s) => s.activeNote);
  const readNote = useGameStore((s) => s.readNote);
  if (!activeNote) return null;

  return (
    <div className="note-modal-backdrop" onClick={() => readNote(null)}>
      <div className="note-paper" onClick={(e) => e.stopPropagation()}>
        <div className="note-header">
          <h2 className="note-title">{activeNote.title}</h2>
          {activeNote.date && <div className="note-date">{activeNote.date}</div>}
        </div>
        <div className="note-body">{activeNote.body}</div>
        <div className="note-footer">
          <div className="note-author">— {activeNote.author}</div>
          <button className="note-close-btn" onClick={() => readNote(null)}>
            [ESC / CLICK TO CLOSE]
          </button>
        </div>
      </div>
    </div>
  );
};
