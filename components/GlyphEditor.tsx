import React, { useState, useRef, useEffect } from 'react';
import { VectorGlyph } from '../types';
import { CheckIcon, CloseIcon, SmoothIcon, NodeMinusIcon, UndoIcon, ZoomInIcon, ZoomOutIcon, MaximizeIcon } from './Icons';

interface GlyphEditorProps {
  glyph: VectorGlyph;
  onSave: (glyph: VectorGlyph) => void;
  onClose: () => void;
}

interface Point {
  x: number;
  y: number;
  type: 'corner' | 'smooth';
  cx1?: number;
  cy1?: number;
  cx2?: number;
  cy2?: number;
}

const parsePath = (d: string): Point[] => {
  const points: Point[] = [];
  const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g);
  
  if (!commands) return [];

  for (const cmd of commands) {
    const type = cmd[0];
    const coords = cmd.slice(1).trim().split(/[\s,]+/).map(Number);
    
    if (type === 'M' || type === 'L') {
      points.push({ x: coords[0], y: coords[1], type: 'corner' });
    }
  }
  return points;
};

const pointsToPath = (points: Point[]): string => {
  if (points.length === 0) return '';
  
  let d = `M${points[0].x} ${points[0].y}`;
  
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    if (curr.type === 'smooth' || next.type === 'smooth') {
       d += ` L${next.x} ${next.y}`;
    } else {
       d += ` L${next.x} ${next.y}`;
    }
  }
  
  d += 'Z';
  return d;
};

const smoothPoints = (points: Point[]): Point[] => {
  const newPoints: Point[] = [];
  if (points.length < 3) return points;

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    const qx = 0.75 * curr.x + 0.25 * next.x;
    const qy = 0.75 * curr.y + 0.25 * next.y;
    
    const rx = 0.25 * curr.x + 0.75 * next.x;
    const ry = 0.25 * curr.y + 0.75 * next.y;

    newPoints.push({ x: qx, y: qy, type: 'corner' });
    newPoints.push({ x: rx, y: ry, type: 'corner' });
  }
  return newPoints;
};

export const GlyphEditor: React.FC<GlyphEditorProps> = ({ glyph, onSave, onClose }) => {
  const [points, setPoints] = useState<Point[]>([]);
  const [history, setHistory] = useState<Point[][]>([]);
  
  // Canvas State
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);

  // Initialize: Center glyph on load
  useEffect(() => {
    const pts = parsePath(glyph.svgPath);
    setPoints(pts);

    // Center the view roughly
    if (svgRef.current) {
      const containerW = svgRef.current.clientWidth;
      const containerH = svgRef.current.clientHeight;
      const scale = Math.min(containerW / (glyph.width + 40), containerH / (glyph.height + 40), 2); 
      setTransform({
        x: (containerW - glyph.width * scale) / 2,
        y: (containerH - glyph.height * scale) / 2,
        k: scale
      });
    }
  }, [glyph]);

  const saveHistory = () => {
    setHistory(prev => [...prev.slice(-10), JSON.parse(JSON.stringify(points))]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setPoints(prev);
    setHistory(h => h.slice(0, -1));
  };

  // --- Zoom & Pan Controls ---

  const handleZoom = (factor: number) => {
    setTransform(t => ({ ...t, k: Math.max(0.1, Math.min(10, t.k * factor)) }));
  };

  const handleFitScreen = () => {
    if (svgRef.current) {
      const containerW = svgRef.current.clientWidth;
      const containerH = svgRef.current.clientHeight;
      const scale = Math.min(containerW / (glyph.width + 40), containerH / (glyph.height + 40), 2); 
      setTransform({
        x: (containerW - glyph.width * scale) / 2,
        y: (containerH - glyph.height * scale) / 2,
        k: scale
      });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    
    setTransform(prev => {
      // Zoom towards mouse position
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return prev;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const newK = Math.max(0.1, Math.min(10, prev.k * scaleFactor));
      
      // Calculate new translation to keep mouse point stable
      const newX = mouseX - (mouseX - prev.x) * (newK / prev.k);
      const newY = mouseY - (mouseY - prev.y) * (newK / prev.k);

      return { x: newX, y: newY, k: newK };
    });
  };

  // --- Interaction Handlers ---

  const handleNodeMouseDown = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    saveHistory();
    setDragIdx(idx);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Panning Canvas
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
      return;
    }

    // 2. Dragging Node
    if (dragIdx !== null && contentRef.current) {
      const pt = svgRef.current!.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      
      // Transform screen coordinates to SVG Local coordinates using the Content Group Matrix
      // This accounts for Zoom and Pan
      const loc = pt.matrixTransform(contentRef.current.getScreenCTM()?.inverse());

      setPoints(pts => {
        const newPts = [...pts];
        newPts[dragIdx] = { ...newPts[dragIdx], x: loc.x, y: loc.y };
        return newPts;
      });
    }
  };

  const handleMouseUp = () => {
    setDragIdx(null);
    setIsPanning(false);
  };

  const handleSave = () => {
    const newPath = pointsToPath(points);
    onSave({ ...glyph, svgPath: newPath });
  };

  const handleDoubleClickNode = (idx: number) => {
    saveHistory();
    if (points.length > 3) {
      setPoints(pts => pts.filter((_, i) => i !== idx));
    }
  };

  const handleSmooth = () => {
    saveHistory();
    setPoints(pts => smoothPoints(pts));
  };

  const handleSimplify = () => {
    saveHistory();
    if (points.length > 6) {
      setPoints(pts => pts.filter((_, i) => i % 2 === 0));
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-stone-50 animate-fade-in">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-stone-200 shadow-sm z-20 relative">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="text-stone-500 hover:text-stone-800">
            <CloseIcon />
          </button>
          <h3 className="font-bold text-stone-800">Vector Editor</h3>
          <div className="h-6 w-px bg-stone-200 mx-2"></div>
          
          <button 
            onClick={handleSmooth}
            className="flex items-center gap-1 text-xs font-medium bg-stone-100 px-3 py-1.5 rounded-md hover:bg-stone-200 text-stone-700"
          >
            <SmoothIcon /> Smooth
          </button>
          <button 
            onClick={handleSimplify}
            className="flex items-center gap-1 text-xs font-medium bg-stone-100 px-3 py-1.5 rounded-md hover:bg-stone-200 text-stone-700"
          >
            <NodeMinusIcon /> Simplify
          </button>
          <button 
            onClick={handleUndo}
            disabled={history.length === 0}
            className="flex items-center gap-1 text-xs font-medium bg-stone-100 px-3 py-1.5 rounded-md hover:bg-stone-200 text-stone-700 disabled:opacity-50"
          >
            <UndoIcon /> Undo
          </button>

          <div className="h-6 w-px bg-stone-200 mx-2"></div>

           {/* Zoom Controls */}
           <div className="flex items-center bg-stone-100 rounded-md p-0.5">
             <button 
               onClick={() => handleZoom(0.9)}
               className="p-1 text-stone-600 hover:bg-white rounded shadow-sm hover:text-stone-900"
               title="Zoom Out"
             >
               <ZoomOutIcon />
             </button>
             <button 
               onClick={handleFitScreen}
               className="p-1 text-stone-600 hover:bg-white rounded shadow-sm hover:text-stone-900 mx-0.5"
               title="Fit to Screen"
             >
               <MaximizeIcon />
             </button>
             <button 
               onClick={() => handleZoom(1.1)}
               className="p-1 text-stone-600 hover:bg-white rounded shadow-sm hover:text-stone-900"
               title="Zoom In"
             >
               <ZoomInIcon />
             </button>
           </div>

        </div>

        <button 
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm transition-colors"
        >
          <CheckIcon /> Save Changes
        </button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden bg-stone-200 cursor-crosshair"
           onMouseDown={handleCanvasMouseDown}
           onMouseMove={handleMouseMove}
           onMouseUp={handleMouseUp}
           onMouseLeave={handleMouseUp}
           onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          className={`w-full h-full touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <defs>
            <pattern id="grid" width={20 / transform.k} height={20 / transform.k} patternUnits="userSpaceOnUse">
              <path d={`M ${20 / transform.k} 0 L 0 0 0 ${20 / transform.k}`} fill="none" stroke="#d6d3d1" strokeWidth={1 / transform.k}/>
            </pattern>
          </defs>

          {/* Content Group with Transform */}
          <g 
            ref={contentRef} 
            transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}
          >
            {/* Infinite Grid Simulation: Render a large rect around current view? 
                Actually, patternUnits="userSpaceOnUse" stays fixed to 0,0. 
                We need a rect that covers the glyph area + margin or infinite?
                Let's just make a big rect centered on the glyph for context.
            */}
            <rect 
              x={-5000} y={-5000} width={10000} height={10000} 
              fill="url(#grid)" 
              opacity={0.5}
            />
            
            {/* Document Bounds/Paper */}
            <rect 
              x={0} y={0} width={glyph.width} height={glyph.height}
              fill="white"
              stroke="#e7e5e4"
              strokeWidth={2 / transform.k}
              className="shadow-sm"
            />

            {/* The Path */}
            <path 
              d={pointsToPath(points)} 
              fill="rgba(59, 130, 246, 0.1)" 
              stroke="#3b82f6" 
              strokeWidth={2 / transform.k}
            />

            {/* Nodes */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={(dragIdx === i ? 6 : 3.5) / transform.k} // Scale node size inversely to zoom so they stay readable
                fill={dragIdx === i ? "#2563eb" : "#fff"}
                stroke="#2563eb"
                strokeWidth={1.5 / transform.k}
                className="cursor-pointer hover:fill-blue-100"
                onMouseDown={(e) => handleNodeMouseDown(i, e)}
                onDoubleClick={() => handleDoubleClickNode(i)}
              />
            ))}
          </g>
        </svg>
        
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow text-xs text-stone-600 pointer-events-none border border-stone-200 flex flex-col gap-1">
           <span>{points.length} nodes</span>
           <span>Zoom: {Math.round(transform.k * 100)}%</span>
           <span className="text-stone-400 italic">Scroll to zoom • Drag to pan</span>
        </div>
      </div>
    </div>
  );
};