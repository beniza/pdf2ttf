import React from 'react';
import { VectorGlyph } from '../types';
import { EditIcon } from './Icons';

interface GlyphGridProps {
  glyphs: VectorGlyph[];
  onDelete: (id: string) => void;
  onEdit: (glyph: VectorGlyph) => void;
}

export const GlyphGrid: React.FC<GlyphGridProps> = ({ glyphs, onDelete, onEdit }) => {
  if (glyphs.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed border-stone-200 rounded-xl">
        <p className="text-stone-400 text-sm">No glyphs extracted yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {glyphs.map((glyph) => (
        <div key={glyph.id} className="relative group bg-white border border-stone-200 rounded-lg p-2 shadow-sm hover:shadow-md transition-all aspect-square flex items-center justify-center">
          <svg 
            viewBox={`0 0 ${glyph.width} ${glyph.height}`} 
            className="w-full h-full max-w-[80px] max-h-[80px]"
          >
            <path d={glyph.svgPath} fill="currentColor" className="text-stone-900" />
          </svg>
          
          {/* Actions Overlay */}
          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => onEdit(glyph)}
              className="bg-blue-50 text-blue-600 p-1.5 rounded-full hover:bg-blue-100 transition-colors"
              title="Edit Path"
            >
              <EditIcon />
            </button>
            <button 
              onClick={() => onDelete(glyph.id)}
              className="bg-red-50 text-red-600 p-1.5 rounded-full hover:bg-red-100 transition-colors"
              title="Delete Glyph"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};