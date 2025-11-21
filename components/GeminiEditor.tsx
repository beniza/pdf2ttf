import React, { useState } from 'react';
import { MagicIcon, UndoIcon } from './Icons';
import { ProcessingStatus } from '../types';

interface GeminiEditorProps {
  status: ProcessingStatus;
  onEdit: (prompt: string) => void;
  onUndo: () => void;
  canUndo: boolean;
}

export const GeminiEditor: React.FC<GeminiEditorProps> = ({ status, onEdit, onUndo, canUndo }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && status !== ProcessingStatus.GENERATING) {
      onEdit(prompt);
      setPrompt('');
    }
  };

  const suggestions = [
    "Make the background pure white and text black",
    "Remove the noise and paper texture",
    "Increase contrast significantly",
    "Thicken the strokes of the characters"
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-stone-800 flex items-center gap-2">
          <MagicIcon />
          AI Enhancement
        </h3>
        {canUndo && (
          <button 
            onClick={onUndo}
            className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-stone-100"
          >
            <UndoIcon /> Undo
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="E.g., 'Remove paper texture...'"
          className="w-full pl-4 pr-12 py-3 rounded-lg bg-stone-50 border border-stone-200 focus:border-stone-500 focus:ring-2 focus:ring-stone-200 outline-none transition-all text-sm"
          disabled={status === ProcessingStatus.GENERATING}
        />
        <button
          type="submit"
          disabled={status === ProcessingStatus.GENERATING || !prompt.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-stone-800 text-white rounded-md hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <MagicIcon />
        </button>
      </form>

      <div className="space-y-2">
        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Suggestions</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setPrompt(s)}
              className="text-xs px-3 py-1.5 bg-stone-50 border border-stone-100 text-stone-600 rounded-full hover:bg-stone-100 hover:border-stone-300 transition-colors text-left"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      
      {status === ProcessingStatus.GENERATING && (
        <div className="flex items-center gap-2 text-xs text-amber-600 animate-pulse">
          <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
          Gemini is processing your image...
        </div>
      )}
    </div>
  );
};