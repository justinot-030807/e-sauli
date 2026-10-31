import React from 'react';
import { Composition } from 'remotion';
import { PromoVideo } from './PromoVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 20-second Vertical Promo Video (1080x1920, 30fps, 600 frames) */}
      <Composition
        id="LostAndFoundPromo"
        component={PromoVideo}
        durationInFrames={600}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
