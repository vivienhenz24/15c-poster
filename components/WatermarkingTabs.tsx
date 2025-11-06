'use client';

import React, { useState } from 'react';

export type WatermarkingTechnique = 'coef-embedding' | 'spread-spectrum' | 'QIM';

type WatermarkingTabsProps = {
  onTechniqueChange?: (technique: WatermarkingTechnique) => void;
  className?: string;
};

const WatermarkingTabs: React.FC<WatermarkingTabsProps> = ({ 
  onTechniqueChange,
  className = "" 
}) => {
  const [selectedTechnique, setSelectedTechnique] = useState<WatermarkingTechnique>('coef-embedding');

  const techniques: { id: WatermarkingTechnique; label: string }[] = [
    { id: 'coef-embedding', label: 'Coef-Embedding' },
    { id: 'spread-spectrum', label: 'Spread-Spectrum' },
    { id: 'QIM', label: 'QIM' },
  ];

  const handleSelect = (technique: WatermarkingTechnique) => {
    setSelectedTechnique(technique);
    onTechniqueChange?.(technique);
  };

  return (
    <div className={`w-full max-w-2xl mx-auto mb-4 ${className}`}>
      <div className="flex gap-2 border-b border-white/20">
        {techniques.map((technique) => (
          <button
            key={technique.id}
            onClick={() => handleSelect(technique.id)}
            className={`px-6 py-3 text-sm font-medium transition-all border-b-2 ${
              selectedTechnique === technique.id
                ? 'border-white text-white'
                : 'border-transparent text-white/50 hover:text-white/80 hover:border-white/30'
            }`}
          >
            {technique.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default WatermarkingTabs;



