'use client';

import React, { useState } from 'react';

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

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/kokoro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: value }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate audio');
      }

      if (data.audio) {
        // Handle audio data - could be URL or base64
        const audioUrl = typeof data.audio === 'string' 
          ? (data.audio.startsWith('data:') ? data.audio : `data:audio/wav;base64,${data.audio}`)
          : data.audio;
        
        onAudioGenerated?.(audioUrl);
      }
    } catch (err) {
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
          disabled={loading || !value.trim()}
          className="mt-4 w-full px-6 py-3 rounded-md bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/20"
        >
          {loading ? 'Generating Audio...' : 'Generate Audio (Ctrl+Enter)'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
};

export default InputField;

