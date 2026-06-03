/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageViewerProps {
  imageUrl?: string;
  imageUrls?: string[];
  initialIndex?: number;
  title: string;
  onClose: () => void;
}

export default function ImageViewer({ imageUrl, imageUrls = [], initialIndex = 0, title, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const imagesList = imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : []);
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialIndex >= 0 && initialIndex < imagesList.length) {
      return initialIndex;
    }
    return 0;
  });

  const currentUrl = imagesList[currentIndex] || '';

  const handleNext = (e: MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % imagesList.length);
    setScale(1);
    setRotation(0);
  };

  const handlePrev = (e: MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + imagesList.length) % imagesList.length);
    setScale(1);
    setRotation(0);
  };

  const handleZoomIn = (e: MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e: MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = (e: MouseEvent) => {
    e.stopPropagation();
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = (e: MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setRotation(0);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md p-4"
        onClick={onClose}
      >
        {/* Header toolbar */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-slate-950/80 to-transparent flex items-center justify-between px-6 z-10"
        >
          <div>
            <h4 className="text-sm font-semibold text-white tracking-tight line-clamp-1">
              {title} {imagesList.length > 1 && `(${currentIndex + 1}/${imagesList.length})`}
            </h4>
            <p className="text-[10px] text-slate-400 font-mono">Inbuilt App Image Viewer</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleRotate}
              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition-colors cursor-pointer"
              title="Rotate"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[10px] font-bold transition-all cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md ml-2 cursor-pointer"
              title="Close Image Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation buttons */}
        {imagesList.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              type="button"
              className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 hover:border-indigo-500/50 text-slate-300 hover:text-white rounded-full transition-all shadow-lg z-20 cursor-pointer active:scale-95 flex items-center justify-center"
              title="Previous Image"
            >
              <ChevronLeft className="w-5 h-5 animate-pulse" />
            </button>
            <button
              onClick={handleNext}
              type="button"
              className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 hover:border-indigo-500/50 text-slate-300 hover:text-white rounded-full transition-all shadow-lg z-20 cursor-pointer active:scale-95 flex items-center justify-center"
              title="Next Image"
            >
              <ChevronRight className="w-5 h-5 animate-pulse" />
            </button>
          </>
        )}

        {/* Central Presentation Canvas */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <motion.div
            style={{ 
              scale,
              rotate: rotation
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="max-w-[90%] max-h-[75%] p-1 rounded-2xl bg-slate-900 shadow-[0_12px_48px_rgba(0,0,0,0.8)] border border-slate-800 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentUrl}
              alt={title}
              className="max-w-full max-h-[70vh] rounded-xl object-contain"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </div>

        {/* Guidance tip footer */}
        <div className="absolute bottom-6 text-[10px] text-slate-400 text-center select-none">
          💡 Swipe/drag or click control keys to pivot and change sizes. {imagesList.length > 1 && "Click side arrow buttons to shift images. "}Tap background zone to exit.
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
