import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneMockup } from '../components/PhoneMockup';
import { TrophyIcon, ZapIcon, CheckIcon } from '../components/VectorIcons';

export const Scene5Rewards: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 5, fps, config: { damping: 14, stiffness: 100 } });
  const badgeProgress = spring({ frame: frame - 25, fps, config: { damping: 10, stiffness: 140 } });
  const pointsVal = Math.min(50, Math.floor(interpolate(frame, [20, 60], [0, 50], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));

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
        background: 'radial-gradient(circle at 60% 50%, #2f0e18 0%, #060204 100%)',
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
          <TrophyIcon size={16} color="#f5b335" />
          <span>Gamified Good Karma</span>
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
          Aura Points at <br />
          <span
            style={{
              background: 'linear-gradient(135deg, #f5b335, #ff4d4d)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Campus Achievements
          </span>
        </h1>

        <p style={{ fontSize: 22, lineHeight: 1.5, color: '#c4b0b3', marginBottom: 36, opacity: titleProgress }}>
          Bawat matagumpay na pagbabalik ay may katumbas na points at achievement badges.
          Tumaas sa campus leaderboard habang tumutulong sa kapwa mag-aaral.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <div style={{ background: '#170b10', border: '1px solid #361720', padding: 14, borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#f5b335' }}>+50</div>
            <div style={{ fontSize: 11, color: '#aaa', fontWeight: 700 }}>Finder Reward</div>
          </div>
          <div style={{ background: '#170b10', border: '1px solid #361720', padding: 14, borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#f5b335' }}>+15</div>
            <div style={{ fontSize: 11, color: '#aaa', fontWeight: 700 }}>Speedy Bonus</div>
          </div>
          <div style={{ background: '#170b10', border: '1px solid #361720', padding: 14, borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#f5b335' }}>+5</div>
            <div style={{ fontSize: 11, color: '#aaa', fontWeight: 700 }}>Owner Confirm</div>
          </div>
        </div>
      </div>

      <div>
        <PhoneMockup rotationY={-8} rotationX={4}>
          <div style={{ padding: '60px 20px 20px', flex: 1, background: '#0e0709', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(245, 179, 53, 0.15)',
                border: '2px solid #f5b335',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                transform: `scale(${badgeProgress})`,
              }}
            >
              <TrophyIcon size={36} color="#f5b335" />
            </div>

            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 4 }}>
              NAISAULI NANG MATAGUMPAY
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 20 }}>
              Kumpirmado ng may-ari ang pagtanggap
            </div>

            <div
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #2b1117 0%, #17090c 100%)',
                border: '1px solid #f5b335',
                borderRadius: 14,
                padding: '16px 20px',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 900, color: '#f5b335' }}>
                +{pointsVal} AURA PTS
              </div>
              <div style={{ fontSize: 11, color: '#ffb938', fontWeight: 700 }}>Synchronized to Profile Ledger</div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#193019',
                border: '1px solid #2e7d32',
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 800,
                color: '#4caf50',
                transform: `scale(${badgeProgress})`,
              }}
            >
              <CheckIcon size={14} color="#4caf50" />
              <span>UNLOCKED: GOOD SAMARITAN BADGE</span>
            </div>
          </div>
        </PhoneMockup>
      </div>
    </div>
  );
};
