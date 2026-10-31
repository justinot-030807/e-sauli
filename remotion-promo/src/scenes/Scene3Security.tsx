import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneFrame } from '../components/PhoneFrame';
import { Callout } from '../components/Callout';

export const Scene3Security: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: {
      damping: 16,
      stiffness: 95,
      mass: 0.9,
    },
  });

  const translateY = (1 - entrance) * 500;
  const rotateZ = (1 - entrance) * -2;
  const opacity = Math.min(1, entrance * 1.4);

  // Floating
  const floatY = Math.sin((frame + 15) / 22) * 5;

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
      {/* Top Callout */}
      <div
        style={{
          marginBottom: 40,
          zIndex: 50,
        }}
      >
        <Callout
          text="Report in seconds"
          subtext="Categorized & verified safely"
          delayFrames={12}
        />
      </div>

      {/* Phone Mockup with report.png */}
      <div
        style={{
          transform: `translateY(${translateY + floatY}px) rotate(${rotateZ}deg)`,
          opacity,
          zIndex: 20,
        }}
      >
        <PhoneFrame
          screenPath="screens/report.png"
          zoom={1.0}
        />
      </div>
    </div>
  );
};
