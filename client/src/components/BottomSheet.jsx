import React, { useState, useRef, useEffect } from 'react';

/**
 * Mobile-First Draggable Bottom Sheet
 * Supports touch gestures, drag handle, snap positions (peek, half, full), and sticky bottom actions.
 */
export default function BottomSheet({
  children,
  snapState = 'half', // 'peek' | 'half' | 'full'
  onSnapChange,
  stickyFooter = null,
  header = null,
  className = ''
}) {
  const [currentSnap, setCurrentSnap] = useState(snapState);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const sheetRef = useRef(null);

  useEffect(() => {
    setCurrentSnap(snapState);
  }, [snapState]);

  const heights = {
    peek: 'h-[28dvh]',
    half: 'h-[54dvh]',
    full: 'h-[88dvh]'
  };

  const handleTouchStart = (e) => {
    setIsDragging(true);
    setDragStartY(e.touches ? e.touches[0].clientY : e.clientY);
    setDragOffset(0);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const diff = currentY - dragStartY;
    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // If dragged downwards significantly
    if (dragOffset > 70) {
      if (currentSnap === 'full') setSnap('half');
      else if (currentSnap === 'half') setSnap('peek');
    } else if (dragOffset < -70) {
      if (currentSnap === 'peek') setSnap('half');
      else if (currentSnap === 'half') setSnap('full');
    }
    setDragOffset(0);
  };

  const setSnap = (snap) => {
    setCurrentSnap(snap);
    if (onSnapChange) onSnapChange(snap);
  };

  return (
    <div
      ref={sheetRef}
      className={`fixed bottom-0 left-0 right-0 z-40 bg-[#121216]/95 backdrop-blur-2xl border-t border-white/10 rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.6)] flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        heights[currentSnap] || heights.half
      } ${className}`}
      style={{
        transform: isDragging ? `translateY(${Math.max(-80, Math.min(200, dragOffset))}px)` : 'none'
      }}
    >
      {/* Draggable Handle Bar Header (min 44px touch target) */}
      <div
        className="w-full flex flex-col items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none touch-target"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseMove={handleTouchMove}
        onMouseUp={handleTouchEnd}
        onClick={() => {
          // Toggle half/full on tap
          setSnap(currentSnap === 'full' ? 'half' : 'full');
        }}
      >
        <div className="w-12 h-1.5 bg-white/30 hover:bg-white/50 rounded-full transition-colors" />
        {header && <div className="w-full mt-2 px-5">{header}</div>}
      </div>

      {/* Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 overscroll-contain">
        {children}
      </div>

      {/* Sticky Bottom Footer Action Button (Safe Area Inset Aware) */}
      {stickyFooter && (
        <div className="p-4 border-t border-white/10 bg-[#121216]/95 backdrop-blur-md pb-safe">
          {stickyFooter}
        </div>
      )}
    </div>
  );
}
