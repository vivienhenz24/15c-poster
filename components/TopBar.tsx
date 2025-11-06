import React from 'react';

type TopBarProps = {
  className?: string;
};

const TopBar: React.FC<TopBarProps> = ({ className }) => {
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 bg-transparent ${className || ''}`}
    >
      <div className="px-6 py-4">
        <h2 className="text-white text-lg font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          PHYS 15C Lab Final Project
        </h2>
      </div>
    </div>
  );
};

export default TopBar;

