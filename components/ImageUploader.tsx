import React, { useCallback } from 'react';
import { UploadIcon } from './Icons';

interface ImageUploaderProps {
  onImageSelected: (base64: string) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected }) => {
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        onImageSelected(result);
      }
    };
    reader.readAsDataURL(file);
  }, [onImageSelected]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-12 bg-stone-50 border-2 border-dashed border-stone-300 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer relative group">
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      <div className="p-4 bg-white rounded-full shadow-md mb-4 group-hover:scale-110 transition-transform">
        <UploadIcon />
      </div>
      <h3 className="text-lg font-semibold text-stone-800 mb-2">Upload Manuscript</h3>
      <p className="text-sm text-stone-500 text-center max-w-xs">
        Drag and drop your archaic text image here, or click to browse.
      </p>
    </div>
  );
};