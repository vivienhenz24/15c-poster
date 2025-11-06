'use client';

import React, { useState, useRef, useEffect } from 'react';

type AudioRecorderProps = {
  onAudioRecorded?: (audioUrl: string, audioBlob: Blob) => void;
  className?: string;
};

type RecordingState = 'idle' | 'recording' | 'stopped';

const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onAudioRecorded,
  className = "" 
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Update audio level visualization
  useEffect(() => {
    if (recordingState === 'recording' && analyserRef.current) {
      const updateLevel = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average level
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const normalizedLevel = average / 255; // Normalize to 0-1
        setAudioLevel(normalizedLevel);
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setAudioLevel(0);
    }
  }, [recordingState]);

  const startRecording = async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analysis for visualization
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setRecordingState('stopped');
        onAudioRecorded?.(url, blob);
        
        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      // Start recording
      mediaRecorder.start();
      setRecordingState('recording');
      setRecordingDuration(0);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
      setRecordingState('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  };

  const toggleRecording = () => {
    if (recordingState === 'idle' || recordingState === 'stopped') {
      startRecording();
    } else if (recordingState === 'recording') {
      stopRecording();
    }
  };

  const handlePlay = () => {
    if (!audioUrl) return;
    
    if (!audioElementRef.current) {
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        audioElementRef.current = null;
      };
    }
    
    if (isPlaying) {
      audioElementRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current?.play();
      setIsPlaying(true);
    }
  };

  const handleClear = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordingState('idle');
    setRecordingDuration(0);
    setIsPlaying(false);
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <div className="px-4 py-6 rounded-md bg-white/10 border border-white/20">
        {/* Audio Level Visualization */}
        <div className="mb-6">
          <div className="h-24 w-full bg-black/30 rounded-md flex items-end justify-center gap-1 p-2">
            {Array.from({ length: 40 }).map((_, i) => {
              const barHeight = audioLevel * 100;
              const isActive = (i / 40) * 100 < barHeight;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t transition-all duration-75 ${
                    isActive
                      ? 'bg-green-400'
                      : 'bg-white/20'
                  }`}
                  style={{
                    height: `${Math.max(4, (audioLevel * 100) / 40)}%`,
                    minHeight: '4px'
                  }}
                />
              );
            })}
          </div>
          {recordingState === 'recording' && (
            <div className="mt-2 text-center text-sm text-white/70">
              Recording: {formatDuration(recordingDuration)}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleRecording}
            disabled={isPlaying}
            className={`px-6 py-3 rounded-md font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              recordingState === 'recording'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-white/20 hover:bg-white/30 border border-white/30 text-white'
            }`}
          >
            {recordingState === 'recording' ? '⏹ Stop' : '● Record'}
          </button>

          {audioUrl && (
            <>
              <button
                onClick={handlePlay}
                disabled={recordingState === 'recording'}
                className="px-6 py-3 rounded-md bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>

              <button
                onClick={handleClear}
                disabled={recordingState === 'recording' || isPlaying}
                className="px-6 py-3 rounded-md bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}

        {recordingState === 'idle' && !audioUrl && (
          <p className="mt-4 text-sm text-white/60 text-center">
            Click Record to start recording audio from your microphone
          </p>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;

