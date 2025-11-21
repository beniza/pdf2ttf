import React, { useState, useRef, useEffect } from 'react';
import { ScissorsIcon, ZoomInIcon, ZoomOutIcon, MaximizeIcon } from './Icons';
import { BoundingBox, VectorGlyph } from '../types';

interface CharacterExtractorProps {
  imageUrl: string;
  onGlyphCreated: (glyph: VectorGlyph) => void;
}

// Helper: Check if a pixel is "on" (black/foreground)
const isPixelOn = (data: Uint8ClampedArray, width: number, x: number, y: number, threshold: number): boolean => {
  if (x < 0 || x >= width || y < 0 || y >= data.length / (4 * width)) return false;
  const idx = (y * width + x) * 4;
  // Considering standard paper: Light background, Dark text.
  // We want Dark pixels. Brightness < Threshold.
  const brightness = 0.34 * data[idx] + 0.5 * data[idx + 1] + 0.16 * data[idx + 2];
  return brightness < threshold;
};

export const CharacterExtractor: React.FC<CharacterExtractorProps> = ({ imageUrl, onGlyphCreated }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [selection, setSelection] = useState<BoundingBox | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [threshold, setThreshold] = useState(128);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Initialize image size and center on load
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      resetView();
    }
  }, [imageUrl]);

  const handleImageLoad = () => {
    if (imgRef.current) {
      setImageSize({ width: imgRef.current.naturalWidth, height: imgRef.current.naturalHeight });
      resetView();
    }
  };

  // Zoom controls
  const handleZoom = (factor: number) => {
    setTransform(t => ({ ...t, scale: Math.max(0.1, Math.min(10, t.scale * factor)) }));
  };

  const resetView = () => {
    if (!containerRef.current || !imgRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const containerH = containerRef.current.clientHeight;
    const imgW = imgRef.current.naturalWidth;
    const imgH = imgRef.current.naturalHeight;
    
    const scale = Math.min(containerW / imgW, containerH / imgH, 1);
    setTransform({
      x: (containerW - imgW * scale) / 2,
      y: (containerH - imgH * scale) / 2,
      scale
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setTransform(prev => {
      const newScale = Math.max(0.1, Math.min(10, prev.scale * scaleFactor));
      const scaleRatio = newScale / prev.scale;
      
      return {
        x: mouseX - (mouseX - prev.x) * scaleRatio,
        y: mouseY - (mouseY - prev.y) * scaleRatio,
        scale: newScale
      };
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    
    // Right click or space for panning
    if (e.button === 2 || e.shiftKey) {
      e.preventDefault();
      setIsPanning(true);
      setStartPos({ x: e.clientX - transform.x, y: e.clientY - transform.y });
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - transform.x) / transform.scale;
    const y = (e.clientY - rect.top - transform.y) / transform.scale;
    
    setStartPos({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform(t => ({
        ...t,
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y
      }));
      return;
    }

    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = (e.clientX - rect.left - transform.x) / transform.scale;
    const currentY = (e.clientY - rect.top - transform.y) / transform.scale;

    setSelection({
      x: Math.min(startPos.x, currentX),
      y: Math.min(startPos.y, currentY),
      width: Math.abs(currentX - startPos.x),
      height: Math.abs(currentY - startPos.y)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsPanning(false);
  };

  const vectoriseSelection = async () => {
    if (!selection || !containerRef.current || selection.width < 5 || selection.height < 5) return;

    const imgElement = containerRef.current.querySelector('img');
    if (!imgElement) return;

    const scaleX = imgElement.naturalWidth / imgElement.clientWidth;
    const scaleY = imgElement.naturalHeight / imgElement.clientHeight;

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(selection.width * scaleX);
    canvas.height = Math.floor(selection.height * scaleY);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw just the selected part
    ctx.drawImage(
      imgElement,
      selection.x * scaleX, selection.y * scaleY, selection.width * scaleX, selection.height * scaleY,
      0, 0, canvas.width, canvas.height
    );

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    // 1. TRACE BOUNDARIES (Simple Moore-Neighbor Tracing)
    // This is a simplified implementation to get a single path.
    // Ideally we'd handle holes, but for now we trace the largest external contour.
    
    const visited = new Set<string>();
    const points: {x: number, y: number}[] = [];
    let foundStart = false;

    // Find starting point
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (isPixelOn(data, w, x, y, threshold)) {
          // Found start.
          // Start Tracing
          let curr = { x, y };
          // Backtrack direction (enter from left: -1, 0)
          let back = { x: x - 1, y: y };
          
          // Simple boundary follower
          const start = { x, y };
          
          // Only trace if we haven't visited this pixel (very basic check)
          // For a robust impl, we'd need full component labeling.
          // Let's just trace the *first* object found in the box for MVP.
          foundStart = true;
          
          // Moore-Neighbor Tracing
          // B = backtrack, P = current
          let p = { ...start };
          let b = { ...back };
          
          const maxSteps = w * h * 2; // Safety break
          let steps = 0;

          do {
            points.push({ ...p });
            visited.add(`${p.x},${p.y}`);
            
            // Scan 8 neighbors of P in clockwise order, starting with B
            // Neighbors relative to P:
            const neighbors = [
               {x: p.x-1, y: p.y-1}, {x: p.x, y: p.y-1}, {x: p.x+1, y: p.y-1},
               {x: p.x+1, y: p.y},   {x: p.x+1, y: p.y+1}, {x: p.x, y: p.y+1},
               {x: p.x-1, y: p.y+1}, {x: p.x-1, y: p.y}
            ];

            // Find index of B in neighbors to start scan
            let bIndex = -1;
            // Locate the neighbor that corresponds to B (or closest to it)
            // Actually, in Moore alg, B is one of the neighbors.
            // If B is not a valid neighbor, we snap to closest? 
            // Let's just use standard offsets.
            
            // Optimization: Just simple radial scan.
            // Order: N, NE, E, SE, S, SW, W, NW
            const offsets = [
              {dx: 0, dy: -1}, {dx: 1, dy: -1}, {dx: 1, dy: 0}, {dx: 1, dy: 1},
              {dx: 0, dy: 1}, {dx: -1, dy: 1}, {dx: -1, dy: 0}, {dx: -1, dy: -1}
            ];
            
            // We need to find which offset B corresponds to relative to P.
            // Then start scanning clockwise from there.
            let startIndex = 0;
            for(let k=0; k<8; k++) {
               if (p.x + offsets[k].dx === b.x && p.y + offsets[k].dy === b.y) {
                 startIndex = k;
                 break;
               }
            }

            let nextP = null;
            let nextB = null;

            for (let i = 0; i < 8; i++) {
              const idx = (startIndex + 1 + i) % 8; // Start from B's next neighbor clockwise
              const off = offsets[idx];
              const targetX = p.x + off.dx;
              const targetY = p.y + off.dy;
              
              if (isPixelOn(data, w, targetX, targetY, threshold)) {
                nextP = { x: targetX, y: targetY };
                // The new backtrack is the previous neighbor in the scan (which was empty)
                const prevIdx = (idx - 1 + 8) % 8;
                nextB = { x: p.x + offsets[prevIdx].dx, y: p.y + offsets[prevIdx].dy };
                break;
              }
            }

            if (nextP) {
              p = nextP;
              b = nextB!;
            } else {
              // Isolated pixel?
              break;
            }
            
            steps++;
          } while ((p.x !== start.x || p.y !== start.y) && steps < maxSteps);

          break; // Stop after first blob
        }
      }
      if (foundStart) break;
    }

    // Simplify points (remove collinear)
    const simplified: {x: number, y: number}[] = [];
    if (points.length > 0) {
      simplified.push(points[0]);
      for (let i = 1; i < points.length - 1; i++) {
        const prev = simplified[simplified.length - 1];
        const curr = points[i];
        const next = points[i + 1];
        // Check if slope matches
        const dx1 = curr.x - prev.x;
        const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x;
        const dy2 = next.y - curr.y;
        
        if (dx1 * dy2 !== dy1 * dx2) {
           simplified.push(curr);
        }
      }
      simplified.push(points[points.length - 1]);
    }

    // Generate SVG Path
    let svgPath = "";
    if (simplified.length > 2) {
      svgPath = `M${simplified[0].x} ${simplified[0].y}`;
      for (let i = 1; i < simplified.length; i++) {
        svgPath += `L${simplified[i].x} ${simplified[i].y}`;
      }
      svgPath += "Z";
    } else {
      // Fallback if tracing failed (e.g. empty)
      svgPath = ""; 
    }

    if (!svgPath) return;

    const glyph: VectorGlyph = {
      id: Date.now().toString(),
      svgPath: svgPath,
      width: canvas.width,
      height: canvas.height,
      name: `Glyph ${Date.now().toString().slice(-4)}`
    };

    onGlyphCreated(glyph);
    setSelection(null);
  };

  return (
    <div className="space-y-4">
       <div className="flex items-center justify-between">
          <h3 className="font-bold text-stone-800 flex items-center gap-2">
            <ScissorsIcon />
            Extract Character
          </h3>
          <div className="flex items-center gap-4">
             {/* Zoom Controls */}
             <div className="flex items-center gap-1 bg-stone-200 rounded-lg px-2 py-1">
                <button 
                  onClick={() => handleZoom(1.2)} 
                  className="p-1 hover:bg-stone-300 rounded transition-colors"
                  title="Zoom In"
                >
                  <ZoomInIcon />
                </button>
                <button 
                  onClick={() => handleZoom(1 / 1.2)} 
                  className="p-1 hover:bg-stone-300 rounded transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOutIcon />
                </button>
                <button 
                  onClick={resetView} 
                  className="p-1 hover:bg-stone-300 rounded transition-colors"
                  title="Reset View"
                >
                  <MaximizeIcon />
                </button>
             </div>

             {/* Threshold Control */}
             <div className="flex items-center gap-2">
                <label className="text-xs text-stone-500">Threshold</label>
                <input 
                  type="range" 
                  min="0" 
                  max="255" 
                  value={threshold} 
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-24 h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer"
                />
             </div>
          </div>
       </div>
       
       <div 
         className="relative bg-stone-100 rounded-lg overflow-hidden border border-stone-300 select-none group"
         style={{ height: '500px' }}
       >
          <div 
            ref={containerRef}
            className="relative w-full h-full"
            style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: '0 0',
                position: 'absolute',
                top: 0,
                left: 0
              }}
            >
              <img 
                ref={imgRef}
                src={imageUrl} 
                alt="Source" 
                className="block pointer-events-none" 
                onLoad={handleImageLoad}
              />
            </div>
            
            {/* Selection Overlay */}
            {selection && (
              <div 
                className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
                style={{
                  left: selection.x * transform.scale + transform.x,
                  top: selection.y * transform.scale + transform.y,
                  width: selection.width * transform.scale,
                  height: selection.height * transform.scale
                }}
              />
            )}
          </div>
          
          {/* Floating Action Button for Extraction */}
          {selection && selection.width > 10 && (
            <div 
              className="absolute z-10"
              style={{ 
                left: Math.min(
                  (selection.x + selection.width) * transform.scale + transform.x, 
                  (containerRef.current?.clientWidth || 0) - 100
                ), 
                top: selection.y * transform.scale + transform.y + selection.height * transform.scale + 10 
              }}
            >
               <button 
                onClick={vectoriseSelection}
                className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
               >
                 Extract Glyph
               </button>
            </div>
          )}
       </div>
       <p className="text-xs text-stone-500">
         Drag to select a character. Hold Shift or right-click to pan. Use mouse wheel to zoom. Adjust threshold to control thickness.
       </p>
    </div>
  );
};