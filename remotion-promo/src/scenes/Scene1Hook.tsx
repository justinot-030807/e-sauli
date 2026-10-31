import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { KineticSentence } from '../components/KineticWord';

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Exit animation at frame 72-90
  const exitProgress = spring({
    frame: frame - 72,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.9 },
  });

  const exitOpacity = frame > 72 ? Math.max(0, 1 - Math.min(1, exitProgress)) : 1;
  const exitScale = frame > 72 ? 1 + Math.min(1, exitProgress) * 0.05 : 1;

  // Badge entrance
  const badgeSpring = spring({
    frame: frame - 5,
    fps,
    config: { damping: 15, stiffness: 110 },
  });

  // Secondary line entrance
  const subSpring = spring({
    frame: frame - 28,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 80px',
        opacity: exitOpacity,
        transform: `scale(${exitScale})`,
      }}
    >
      {/* Top Campus Pill Badge */}
      <div
        style={{
          transform: `scale(${badgeSpring}) translateY(${(1 - badgeSpring) * 20}px)`,
          opacity: badgeSpring,
          backgroundColor: '#FFFFFF',
          padding: '12px 28px',
          borderRadius: 30,
          border: '1.5px solid rgba(212, 175, 55, 0.4)',
          boxShadow: '0 8px 24px rgba(128, 0, 0, 0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: '#800000',
          }}
        />
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#800000',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Campus Lost & Found Platform
        </span>
      </div>

      {/* Main Bold Kinetic Hook */}
      <div style={{ maxWidth: 900, textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -2,
            margin: 0,
            color: '#1A1A1A',
          }}
        >
          <KineticSentence
            text="Lost something on campus?"
            highlightWords={['Lost', 'something?']}
            stagger={5}
          />
        </h1>
      </div>

      {/* Subtitle: Don't panic. */}
      <div
        style={{
          marginTop: 36,
          transform: `scale(${subSpring}) translateY(${(1 - subSpring) * 25}px)`,
          opacity: subSpring,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: '#800000',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: -0.5,
          }}
        >
          Don't panic.
        </span>
        <div
          style={{
            height: 4,
            width: 60,
            backgroundColor: '#D4AF37',
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};
