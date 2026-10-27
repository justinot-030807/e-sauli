import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ShieldIcon, BoxIcon, ZapIcon } from '../components/VectorIcons';

export const Scene6Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoomProgress = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        position: 'relative',
        background: 'radial-gradient(circle at 50% 50%, #3d0c19 0%, #080204 100%)',
        overflow: 'hidden',
        padding: '0 80px',
      }}
    >
      {/* Background Pulse Rings */}
      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          border: '1px solid rgba(245, 179, 53, 0.15)',
          transform: `scale(${zoomProgress})`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 950,
          height: 950,
          borderRadius: '50%',
          border: '1px solid rgba(139, 30, 45, 0.25)',
          transform: `scale(${zoomProgress * 1.15})`,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(245, 179, 53, 0.15)',
          border: '1px solid rgba(245, 179, 53, 0.4)',
          padding: '8px 20px',
          borderRadius: 30,
          color: '#f5b335',
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}
      >
        <ShieldIcon size={18} color="#f5b335" />
        <span>Official Campus Deployment</span>
      </div>

      <h1
        style={{
          fontSize: 104,
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '-3px',
          lineHeight: 1,
          marginBottom: 18,
          fontFamily: 'sans-serif',
          background: 'linear-gradient(135deg, #ffffff 0%, #ffcf75 50%, #f5b335 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          transform: `scale(${zoomProgress})`,
        }}
      >
        E-SAULI
      </h1>

      <p
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#f3d5d9',
          maxWidth: 800,
          lineHeight: 1.4,
          marginBottom: 40,
        }}
      >
        Ang Bilis Maibalik. Ligtas. Mapagkakatiwalaan.
      </p>

      <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
        <div style={{ background: '#190a0f', border: '1px solid #361720', padding: '14px 28px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <BoxIcon size={20} color="#f5b335" />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Android APK Build</span>
        </div>

        <div style={{ background: '#190a0f', border: '1px solid #361720', padding: '14px 28px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ZapIcon size={20} color="#f5b335" />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Instant Web & PWA</span>
        </div>

        <div style={{ background: '#190a0f', border: '1px solid #361720', padding: '14px 28px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldIcon size={20} color="#f5b335" />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>100% Student Verified</span>
        </div>
      </div>
    </div>
  );
};
