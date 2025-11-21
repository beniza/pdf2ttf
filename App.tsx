import React, { useState, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { GeminiEditor } from './components/GeminiEditor';
import { CharacterExtractor } from './components/CharacterExtractor';
import { GlyphGrid } from './components/GlyphGrid';
import { GlyphEditor } from './components/GlyphEditor';
import { editImageWithGemini } from './services/geminiService';
import { ProcessingStatus, VectorGlyph } from './types';

export default function App() {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [glyphs, setGlyphs] = useState<VectorGlyph[]>([]);
  const [editingGlyph, setEditingGlyph] = useState<VectorGlyph | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelected = (base64: string) => {
    setHistory([]);
    setCurrentImage(base64);
    setGlyphs([]); 
    setEditingGlyph(null);
  };

  const handleEditImage = async (prompt: string) => {
    if (!currentImage) return;

    setStatus(ProcessingStatus.GENERATING);
    setError(null);

    try {
      // Save current state to history before editing
      setHistory(prev => [...prev, currentImage]);
      
      const newImageBase64 = await editImageWithGemini(currentImage, prompt);
      setCurrentImage(newImageBase64);
      setStatus(ProcessingStatus.IDLE);
    } catch (err) {
      setError("Failed to update image. Please try a different prompt.");
      setStatus(ProcessingStatus.ERROR);
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setCurrentImage(previous);
    setHistory(prev => prev.slice(0, -1));
  };

  const handleGlyphCreated = (glyph: VectorGlyph) => {
    setGlyphs(prev => [...prev, glyph]);
  };

  const handleDeleteGlyph = (id: string) => {
    setGlyphs(prev => prev.filter(g => g.id !== id));
  };
  
  const handleStartEditGlyph = (glyph: VectorGlyph) => {
    setEditingGlyph(glyph);
  };

  const handleSaveGlyph = (updatedGlyph: VectorGlyph) => {
    setGlyphs(prev => prev.map(g => g.id === updatedGlyph.id ? updatedGlyph : g));
    setEditingGlyph(null);
  };

  const handleReset = () => {
    setCurrentImage(null);
    setHistory([]);
    setGlyphs([]);
    setEditingGlyph(null);
    setStatus(ProcessingStatus.IDLE);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-stone-50 text-stone-900 overflow-hidden">
      {/* Header */}
      <header className="flex-none h-16 bg-white border-b border-stone-200 flex items-center justify-between px-8 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center text-white font-serif text-xl font-bold">
            A
          </div>
          <h1 className="text-lg font-semibold tracking-tight">ArchaicType <span className="text-stone-400 font-normal">Vectorizer</span></h1>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={handleReset}
             className={`text-sm font-medium text-stone-500 hover:text-red-600 transition-colors ${!currentImage && !editingGlyph ? 'opacity-0 pointer-events-none' : ''}`}
           >
             Reset Project
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Column: Workspace (Image Area OR Editor) */}
        <div className="flex-1 bg-stone-100/50 relative flex flex-col">
          
          {editingGlyph ? (
             <GlyphEditor 
               glyph={editingGlyph} 
               onSave={handleSaveGlyph} 
               onClose={() => setEditingGlyph(null)}
             />
          ) : (
            <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
              <div className="w-full max-w-3xl flex-1 flex flex-col">
                {!currentImage ? (
                  <div className="flex-1 flex items-center justify-center min-h-[400px]">
                    <div className="w-full max-w-md">
                      <ImageUploader onImageSelected={handleImageSelected} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                     {/* Toolbar above image */}
                     <div className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-stone-200">
                       <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide px-2">Original Source</span>
                       <div className="text-xs text-stone-400">
                         {history.length > 0 ? 'Edited Image' : 'Original Image'}
                       </div>
                     </div>

                     {/* The actual tool */}
                     <CharacterExtractor 
                        imageUrl={currentImage} 
                        onGlyphCreated={handleGlyphCreated}
                     />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Tools & Results */}
        <div className="w-96 bg-white border-l border-stone-200 flex flex-col shadow-xl z-10">
          <div className="p-6 border-b border-stone-100 flex-none">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">Tools</h2>
            
            {/* Image Editor (Gemini) */}
            <div className={`${(!currentImage || editingGlyph) ? 'opacity-50 pointer-events-none grayscale' : ''} transition-all`}>
               <GeminiEditor 
                 status={status} 
                 onEdit={handleEditImage} 
                 onUndo={handleUndo}
                 canUndo={history.length > 0}
               />
               {error && (
                 <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100">
                   {error}
                 </div>
               )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wider mb-4 flex items-center justify-between">
              Extracted Glyphs
              <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full text-xs">{glyphs.length}</span>
            </h2>
            <GlyphGrid 
              glyphs={glyphs} 
              onDelete={handleDeleteGlyph} 
              onEdit={handleStartEditGlyph}
            />
          </div>

          {/* Download/Export Footer */}
          <div className="p-4 border-t border-stone-100 bg-stone-50">
            <button 
              className="w-full py-3 bg-stone-900 text-white rounded-lg font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
              disabled={glyphs.length === 0}
              onClick={() => {
                alert("This would download a TTF/SVG font file in a real app!");
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Font
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}