import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneFrame } from '../components/PhoneFrame';
import { Callout } from '../components/Callout';

export const Scene2Matching: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slide up entrance with spring physics
  const entrance = spring({
    frame,
    fps,
    config: {
      damping: 16,
      stiffness: 95,
      mass: 0.9,
    },
  });

  const translateY = (1 - entrance) * 600;
  const opacity = Math.min(1, entrance * 1.5);

  // Gentle floating animation
  const floatY = Math.sin(frame / 22) * 5;

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
      {/* Top Floating Pill Callout */}
      <div
        style={{
          marginBottom: 40,
          zIndex: 50,
        }}
      >
        <Callout
          text="Browse found items"
          subtext="Real-time campus feed & search"
          delayFrames={14}
        />
      </div>

      {/* Phone Mockup with home.png */}
      <div
        style={{
          transform: `translateY(${translateY + floatY}px)`,
          opacity,
          zIndex: 20,
        }}
      >
        <PhoneFrame
          screenPath="screens/home.png"
          zoom={1.0}
        />
      </div>
    </div>
  );
};
