import React from 'react';
import { Series, Audio, staticFile } from 'remotion';
import { Scene1Hook } from './scenes/Scene1Hook';
import { Scene2Matching } from './scenes/Scene2Matching';
import { Scene3Security } from './scenes/Scene3Security';
import { Scene4Chat } from './scenes/Scene4Chat';
import { Scene5Rewards } from './scenes/Scene5Rewards';
import { Scene6Outro } from './scenes/Scene6Outro';

export const ESaultCommercial: React.FC = () => {
  // 30 FPS, each scene is 150 frames = 5 seconds
  const SCENE_DURATION = 150;

  return (
    <div style={{ flex: 1, backgroundColor: '#070406', width: '100%', height: '100%', position: 'relative' }}>
      {/* Voiceover Audio Track (Female voiceover) */}
      <Audio src={staticFile('voiceover.wav')} volume={1.0} />

      {/* Synchronized Choreographed Scenes */}
      <Series>
        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <Scene1Hook />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <Scene2Matching />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <Scene3Security />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <Scene4Chat />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <Scene5Rewards />
        </Series.Sequence>

        <Series.Sequence durationInFrames={SCENE_DURATION}>
          <Scene6Outro />
        </Series.Sequence>
      </Series>
    </div>
  );
};
