import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneFrame } from '../components/PhoneFrame';
import { Callout } from '../components/Callout';
import { GoldConfetti } from '../components/GoldConfetti';

export const Scene4Chat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: {
      damping: 15,
      stiffness: 100,
      mass: 0.9,
    },
  });

  const translateY = (1 - entrance) * 500;
  const rotateZ = (1 - entrance) * 2;
  const opacity = Math.min(1, entrance * 1.5);

  const floatY = Math.sin((frame + 30) / 20) * 5;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        paddingTop: 130,
      }}
    >
      {/* Gold Confetti Burst */}
      <GoldConfetti burstFrame={14} count={50} />

      {/* Top Callout */}
      <div
        style={{
          marginBottom: 40,
          zIndex: 50,
        }}
      >
        <Callout
          text="Climb the leaderboard"
          subtext="Help others & earn Aura points"
          delayFrames={10}
        />
      </div>

      {/* Phone Mockup with leaderboard.png */}
      <div
        style={{
          transform: `translateY(${translateY + floatY}px) rotate(${rotateZ}deg)`,
          opacity,
          zIndex: 20,
        }}
      >
        <PhoneFrame
          screenPath="screens/leaderboard.png"
          zoom={1.0}
        />
      </div>
    </div>
  );
};
