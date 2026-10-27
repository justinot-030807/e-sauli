import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface PhoneMockupProps {
  children: React.ReactNode;
  rotationY?: number;
  rotationX?: number;
  scale?: number;
  islandAlert?: string;
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  children,
  rotationY = -8,
  rotationX = 4,
  scale = 1,
  islandAlert,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });

  const floatY = Math.sin(frame / 20) * 8;

  return (
    <div
      style={{
        width: 380,
        height: 780,
        perspective: 1400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `translateY(${floatY}px) scale(${entrance * scale})`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#0a0507',
          borderRadius: 54,
          border: '12px solid #1a1214',
          boxShadow: `
            0 0 0 2px rgba(245, 179, 53, 0.4),
            0 40px 90px rgba(0, 0, 0, 0.9),
            0 0 50px rgba(139, 30, 45, 0.35)
          `,
          position: 'relative',
          overflow: 'hidden',
          transform: `rotateY(${rotationY}deg) rotateX(${rotationX}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            width: islandAlert ? 260 : 110,
            height: islandAlert ? 38 : 26,
            backgroundColor: islandAlert ? '#1e0a0e' : '#000000',
            border: islandAlert ? '1px solid #f5b335' : '1px solid #222',
            borderRadius: 24,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: islandAlert ? '0 0 20px rgba(245, 179, 53, 0.4)' : 'none',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: '#111',
              border: '1px solid #333',
            }}
          />
          {islandAlert && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#f5b335',
                letterSpacing: '-0.2px',
                fontFamily: 'sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              {islandAlert}
            </span>
          )}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#080808',
            }}
          />
        </div>

        {/* Screen Viewport */}
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#0f0a0c',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: '#ffffff',
            position: 'relative',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
