import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneMockup } from '../components/PhoneMockup';
import { MessageSquareIcon, PinIcon, ShieldIcon } from '../components/VectorIcons';

export const Scene4Chat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 100 } });
  const msg1Progress = spring({ frame: frame - 15, fps, config: { damping: 12, stiffness: 120 } });
  const msg2Progress = spring({ frame: frame - 35, fps, config: { damping: 12, stiffness: 120 } });
  const msg3Progress = spring({ frame: frame - 55, fps, config: { damping: 12, stiffness: 120 } });

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
        background: 'radial-gradient(circle at 45% 50%, #2a0b14 0%, #060204 100%)',
        overflow: 'hidden',
      }}
    >
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
          <MessageSquareIcon size={16} color="#f5b335" />
          <span>Realtime Scoped Communication</span>
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
          Ligtas na Koordinasyon at <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #f5b335, #ff4d4d)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Campus Office Handover
          </span>
        </h1>

        <p style={{ fontSize: 22, lineHeight: 1.5, color: '#c4b0b3', marginBottom: 36, opacity: titleProgress }}>
          Direktang mag-usap sa pamamagitan ng private Supabase Realtime channel.
          Para sa mga sensitibong gamit, opisyal itong ite-turnover sa Lost & Found Office.
        </p>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ background: '#170b10', border: '1px solid #361720', padding: '14px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <PinIcon size={20} color="#f5b335" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Official Campus Custody</div>
              <div style={{ fontSize: 11, color: '#888' }}>Ground Floor Admin Building</div>
            </div>
          </div>

          <div style={{ background: '#170b10', border: '1px solid #361720', padding: '14px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldIcon size={20} color="#f5b335" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Role Guarded</div>
              <div style={{ fontSize: 11, color: '#888' }}>Only verified claims can chat</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <PhoneMockup rotationY={8} rotationX={-4}>
          <div style={{ background: '#7a1f2b', padding: '48px 16px 14px', borderBottom: '1px solid rgba(245, 179, 53, 0.3)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Chat: Casio Calculator</div>
            <div style={{ fontSize: 11, color: '#ffd573' }}>• Online (Realtime Active)</div>
          </div>

          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, background: '#0e0709' }}>
            <div
              style={{
                alignSelf: 'flex-start',
                background: '#1d1114',
                border: '1px solid #3b1922',
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 2px',
                fontSize: 12,
                color: '#fff',
                maxWidth: '85%',
                opacity: msg1Progress,
                transform: `translateY(${(1 - msg1Progress) * 15}px)`,
              }}
            >
              Naiwan ko po sa Room 304 matapos ang klase. Maraming salamat po sa pagpulot!
            </div>

            <div
              style={{
                alignSelf: 'flex-end',
                background: '#7a1f2b',
                padding: '10px 14px',
                borderRadius: '14px 14px 2px 14px',
                fontSize: 12,
                color: '#fff',
                maxWidth: '85%',
                opacity: msg2Progress,
                transform: `translateY(${(1 - msg2Progress) * 15}px)`,
              }}
            >
              Walang anuman! Iniwan ko na po sa Lost & Found Office sa Admin Building para safe.
            </div>

            <div
              style={{
                alignSelf: 'flex-start',
                background: '#1d1114',
                border: '1px solid #3b1922',
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 2px',
                fontSize: 12,
                color: '#fff',
                maxWidth: '85%',
                opacity: msg3Progress,
                transform: `translateY(${(1 - msg3Progress) * 15}px)`,
              }}
            >
              Salamat! Kukunin ko po agad sa office break time.
            </div>
          </div>
        </PhoneMockup>
      </div>
    </div>
  );
};
