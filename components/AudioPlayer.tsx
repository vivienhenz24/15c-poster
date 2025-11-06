'use client';

import React from 'react';

type AudioPlayerProps = {
  audioUrl: string | null;
  className?: string;
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, className = "" }) => {
  if (!audioUrl) {
    return null;
  }

  return (
    <div className={`w-full max-w-2xl mx-auto mt-6 ${className}`}>
      <div className="px-4 py-4 rounded-md bg-white/10 border border-white/20">
        <p className="text-sm text-white/80 mb-3">Generated Audio:</p>
        <audio 
          controls 
          className="w-full"
          src={audioUrl}
        >
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  );
};

export default AudioPlayer;

