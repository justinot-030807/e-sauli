import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneMockup } from '../components/PhoneMockup';
import { ZapIcon, BellIcon, PinIcon } from '../components/VectorIcons';

export const Scene2Matching: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 100 } });
  const alertProgress = spring({ frame: frame - 25, fps, config: { damping: 12, stiffness: 130 } });
  const gaugeVal = Math.min(94, Math.floor(interpolate(frame, [15, 60], [0, 94], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 120px',
        position: 'relative',
        background: 'radial-gradient(circle at 40% 50%, #2e0d16 0%, #060204 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Left Column Text */}
      <div style={{ maxWidth: 650, zIndex: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(245, 179, 53, 0.15)',
            border: '1px solid rgba(245, 179, 53, 0.4)',
            padding: '6px 16px',
            borderRadius: 24,
            color: '#f5b335',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 20,
            opacity: titleProgress,
          }}
        >
          <ZapIcon size={16} color="#f5b335" />
          <span>Real-time Telemetry</span>
        </div>

        <h1
          style={{
            fontSize: 60,
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.15,
            letterSpacing: '-1.5px',
            marginBottom: 20,
            opacity: titleProgress,
          }}
        >
          Deterministic <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #f5b335, #ff4d4d)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Smart Matching Engine
          </span>
        </h1>

        <p style={{ fontSize: 22, lineHeight: 1.5, color: '#c4b0b3', marginBottom: 36, opacity: titleProgress }}>
          Hindi na kailangang mag-abang. Pagkapasok ng report sa database,
          awtomatikong tinutugma ng system ang kategorya, petsa, at lokasyon.
        </p>

        {/* Telemetry Match Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#14090c', border: '1px solid rgba(245, 179, 53, 0.3)', padding: 18, borderRadius: 14 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#f5b335' }}>+40 PTS</div>
            <div style={{ fontSize: 13, color: '#aaa', fontWeight: 600 }}>Category Similarity</div>
          </div>
          <div style={{ background: '#14090c', border: '1px solid rgba(245, 179, 53, 0.3)', padding: 18, borderRadius: 14 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#f5b335' }}>+30 PTS</div>
            <div style={{ fontSize: 13, color: '#aaa', fontWeight: 600 }}>Location Proximity</div>
          </div>
        </div>
      </div>

      {/* Right Phone Mockup with Expanding Dynamic Island */}
      <div>
        <PhoneMockup rotationY={6} rotationX={-4} islandAlert={frame > 20 ? 'MATCH DETECTED (94%)' : undefined}>
          {/* Match Alert Card overlay */}
          <div
            style={{
              position: 'absolute',
              top: 70,
              left: 16,
              right: 16,
              background: 'rgba(122, 31, 43, 0.95)',
              border: '1px solid #f5b335',
              borderRadius: 16,
              padding: 18,
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
              zIndex: 80,
              transform: `scale(${alertProgress}) translateY(${(1 - alertProgress) * -40}px)`,
              opacity: alertProgress,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f5b335', fontWeight: 800, fontSize: 12, marginBottom: 6 }}>
              <BellIcon size={16} color="#f5b335" />
              <span>MATCH ALERT: ROOM 304</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
              May nag-turnover ng kalkulador na tugma sa nawawala mong gamit.
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#ffd573', fontWeight: 700 }}>
              Confidence Score: {gaugeVal}% Match
            </div>
          </div>

          {/* Underneath Mock Screen */}
          <div style={{ padding: '140px 18px 20px', flex: 1, background: '#0d0709' }}>
            <div style={{ background: '#1c0f13', borderRadius: 16, padding: 18, border: '1px solid #3d1b22' }}>
              <span style={{ fontSize: 11, background: '#f5b335', color: '#000', padding: '3px 8px', borderRadius: 6, fontWeight: 800 }}>
                AUTOMATED MATCH
              </span>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '10px 0 6px' }}>
                Casio FX-991EX ClassWiz
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#bbb' }}>
                <PinIcon size={14} color="#f5b335" />
                <span>Classroom Bldg • Room 304</span>
              </div>
            </div>
          </div>
        </PhoneMockup>
      </div>
    </div>
  );
};
