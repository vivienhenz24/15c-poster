'use client';

import React, { useState } from 'react';

type InputFieldProps = {
  placeholder?: string;
  className?: string;
  onChange?: (value: string) => void;
};

const InputField: React.FC<InputFieldProps> = ({ 
  placeholder = "Enter text...", 
  className = "",
  onChange 
}) => {
  const [value, setValue] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue);
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={6}
        className="w-full px-4 py-6 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all resize-y"
      />
    </div>
  );
};

export default InputField;

