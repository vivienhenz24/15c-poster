'use client';

import React, { useState, useEffect } from 'react';

type InputFieldProps = {
  placeholder?: string;
  className?: string;
  onChange?: (value: string) => void;
  onAudioGenerated?: (audioUrl: string) => void;
};

const InputField: React.FC<InputFieldProps> = ({ 
  placeholder = "Enter text...", 
  className = "",
  onChange,
  onAudioGenerated
}) => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [puterReady, setPuterReady] = useState(false);

  // Wait for Puter.js to load
  useEffect(() => {
    const checkPuter = () => {
      if (typeof window !== 'undefined' && (window as any).puter) {
        setPuterReady(true);
        console.log('[InputField] Puter.js is ready');
      } else {
        // Check again after a short delay
        setTimeout(checkPuter, 100);
      }
    };
    checkPuter();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!value.trim()) {
      setError('Please enter some text');
      return;
    }

    // Check if Puter.js is loaded
    if (!puterReady || typeof window === 'undefined' || !(window as any).puter) {
      setError('Puter.js is not loaded yet. Please wait a moment and try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use Puter.js for text-to-speech
      const puter = (window as any).puter;
      
      if (!puter.ai || !puter.ai.txt2speech) {
        throw new Error('Puter.js TTS not available');
      }

      console.log('[InputField] Calling puter.ai.txt2speech with text:', value);
      const audio = await puter.ai.txt2speech(value, {
        engine: "neural",
        language: "en-US"
      });

      console.log('[InputField] Audio received:', audio);
      console.log('[InputField] Audio type:', typeof audio);
      console.log('[InputField] Audio src:', audio?.src);

      // Puter.js returns an HTMLAudioElement
      // Convert it to a URL that can be used by AudioPlayer
      if (audio && audio.src) {
        // The audio element has a src property (URL or blob URL)
        onAudioGenerated?.(audio.src);
      } else {
        throw new Error('No audio data received from Puter.js');
      }
    } catch (err) {
      console.error('[InputField] Error generating audio:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <div className="relative">
        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={6}
          disabled={loading}
          className="w-full px-4 py-6 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all resize-y disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !value.trim() || !puterReady}
          className="mt-4 w-full px-6 py-3 rounded-md bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/20"
        >
          {!puterReady ? 'Loading TTS...' : loading ? 'Generating Audio...' : 'Generate Audio (Ctrl+Enter)'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};

export default InputField;

