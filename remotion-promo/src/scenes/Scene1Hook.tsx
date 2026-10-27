import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneMockup } from '../components/PhoneMockup';
import { SearchIcon, PinIcon, ShieldIcon, BoxIcon } from '../components/VectorIcons';

export const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 100 } });
  const descProgress = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 100 } });
  const phoneProgress = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 90 } });

  // Typing simulation
  const fullText = 'Casio FX-991EX Room 304';
  const charCount = Math.floor(interpolate(frame, [25, 75], [0, fullText.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const typedText = fullText.substring(0, charCount);

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
        background: 'radial-gradient(circle at 60% 50%, #2b0b12 0%, #080305 100%)',
        overflow: 'hidden',
      }}
    >
      {/* HUD Telemetry Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 120,
          display: 'flex',
          gap: 20,
          fontSize: 12,
          fontFamily: 'monospace',
          color: 'rgba(245, 179, 53, 0.7)',
          letterSpacing: 2,
        }}
      >
        <span>SYS.STATUS: OPERATIONAL</span>
        <span>LOCATION: CAMPUS_GRID_PH</span>
        <span>SECURITY: LEVEL_4_HMAC</span>
      </div>

      {/* Kinetic Typography Left Column */}
      <div style={{ maxWidth: 650, zIndex: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(139, 30, 45, 0.35)',
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
            transform: `translateY(${(1 - titleProgress) * 20}px)`,
          }}
        >
          <ShieldIcon size={16} color="#f5b335" />
          <span>Campus Loss Mitigation</span>
        </div>

        <h1
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.1,
            letterSpacing: '-1.5px',
            marginBottom: 20,
            fontFamily: 'sans-serif',
            opacity: titleProgress,
            transform: `translateY(${(1 - titleProgress) * 30}px)`,
          }}
        >
          Naiwan mo ba ang <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #f5b335, #ff6b3d)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            gamit mo sa campus?
          </span>
        </h1>

        <p
          style={{
            fontSize: 22,
            lineHeight: 1.5,
            color: '#c4b0b3',
            marginBottom: 36,
            opacity: descProgress,
            transform: `translateY(${(1 - descProgress) * 20}px)`,
          }}
        >
          Huwag mag-panic. Hindi na kailangan mag-post sa sari-saring Freedom Wall.
          Nandito na ang sentralisado at ligtas na sistema.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 16,
            opacity: descProgress,
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '12px 20px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <BoxIcon size={18} color="#f5b335" />
            <span>Real-time Discovery</span>
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '12px 20px',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ShieldIcon size={18} color="#f5b335" />
            <span>Anti-Theft Protocol</span>
          </div>
        </div>
      </div>

      {/* 3D Phone Chassis on Right */}
      <div style={{ opacity: phoneProgress, transform: `translateX(${(1 - phoneProgress) * 60}px)` }}>
        <PhoneMockup rotationY={-12} rotationX={6}>
          {/* App Header */}
          <div
            style={{
              background: 'linear-gradient(180deg, #7a1f2b 0%, #58141e 100%)',
              padding: '48px 18px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(245, 179, 53, 0.3)',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>E-SAULI</span>
            <span style={{ fontSize: 11, background: '#f5b335', color: '#1a0d0f', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>LIVE</span>
          </div>

          {/* Search Box */}
          <div style={{ padding: 16 }}>
            <div
              style={{
                background: '#1a1013',
                border: '1px solid rgba(245, 179, 53, 0.35)',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#fff',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              <SearchIcon size={16} color="#f5b335" />
              <span>{typedText}</span>
              <span style={{ width: 2, height: 14, background: '#f5b335', opacity: frame % 15 < 8 ? 1 : 0 }} />
            </div>

            {/* Item Card */}
            <div
              style={{
                background: '#160d10',
                borderRadius: 16,
                padding: 16,
                border: '1px solid rgba(245, 179, 53, 0.3)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, background: '#2e7d32', color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                  NAHANAP
                </span>
                <span style={{ fontSize: 10, color: '#aaa' }}>10 mins ago</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                Casio Scientific Calculator
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#c4b0b3' }}>
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
