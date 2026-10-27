import React from 'react';
import { Composition } from 'remotion';
import { ESaultCommercial } from './ESaultCommercial';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 16:9 Landscape Main Broadcast Commercial (1080p Full HD) */}
      <Composition
        id="ESaultCommercial"
        component={ESaultCommercial}
        durationInFrames={900}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 9:16 Vertical Story / Reel / TikTok Edition (1080x1920) */}
      <Composition
        id="ESaultCommercialVertical"
        component={ESaultCommercial}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
