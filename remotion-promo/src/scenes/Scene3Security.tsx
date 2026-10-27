import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneMockup } from '../components/PhoneMockup';
import { LockIcon, KeyIcon, CheckIcon, ShieldIcon } from '../components/VectorIcons';

export const Scene3Security: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 100 } });
  const checkProgress = spring({ frame: frame - 35, fps, config: { damping: 10, stiffness: 150 } });

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
        background: 'radial-gradient(circle at 65% 50%, #290812 0%, #060204 100%)',
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
          <LockIcon size={16} color="#f5b335" />
          <span>Cryptographic Authentication</span>
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
          Protektadong Pag-claim gamit ang <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #f5b335, #ff4d4d)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Secret Question & HMAC
          </span>
        </h1>

        <p style={{ fontSize: 22, lineHeight: 1.5, color: '#c4b0b3', marginBottom: 36, opacity: titleProgress }}>
          Hindi basta-basta makukuha ng kung sino-sino. May SHA-256 HMAC verification para sa halaga ng pera,
          at 3-strike lockout laban sa brute force o mga pekeng claimant.
        </p>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ background: '#170b10', border: '1px solid #361720', padding: '14px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <KeyIcon size={20} color="#f5b335" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>HMAC Zero-Knowledge</div>
              <div style={{ fontSize: 11, color: '#888' }}>Amount never leaves server</div>
            </div>
          </div>

          <div style={{ background: '#170b10', border: '1px solid #361720', padding: '14px 20px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldIcon size={20} color="#f5b335" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>3-Strike Lockout</div>
              <div style={{ fontSize: 11, color: '#888' }}>Anti-abuse automated guard</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Phone Mockup */}
      <div>
        <PhoneMockup rotationY={-6} rotationX={4}>
          <div style={{ padding: '60px 18px 20px', flex: 1, background: '#0e080a' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#f5b335', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <LockIcon size={14} color="#f5b335" />
              <span>CLAIM VERIFICATION</span>
            </div>

            <div style={{ background: '#180e12', borderRadius: 16, padding: 18, border: '1px solid rgba(245, 179, 53, 0.3)' }}>
              <div style={{ fontSize: 11, color: '#aaa', fontWeight: 700, marginBottom: 4 }}>TANONG NG NAKAPULOT:</div>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginBottom: 16 }}>
                "Anong sticker ang nakalagay sa likod ng cover?"
              </div>

              <div style={{ fontSize: 11, color: '#aaa', fontWeight: 700, marginBottom: 4 }}>IYONG SAGOT:</div>
              <div
                style={{
                  background: '#231217',
                  border: '1px solid #2e7d32',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>Orange Cat Sticker</span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#2e7d32',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#fff',
                    transform: `scale(${checkProgress})`,
                    opacity: checkProgress,
                  }}
                >
                  <CheckIcon size={12} color="#fff" />
                  <span>VERIFIED</span>
                </div>
              </div>

              <div style={{ marginTop: 16, fontSize: 11, color: '#4caf50', fontWeight: 700, opacity: checkProgress }}>
                ✓ Tugma sa cryptographic record sa server.
              </div>
            </div>
          </div>
        </PhoneMockup>
      </div>
    </div>
  );
};
