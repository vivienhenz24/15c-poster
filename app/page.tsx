"use client";

import dynamic from 'next/dynamic';

const PixelBlast = dynamic(() => import('@/components/PixelBlast'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 w-screen h-screen bg-black" />
});

export default function Home() {
  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-black">
      {/* Hero Background */}
      <div className="fixed top-0 left-0 w-screen h-screen" style={{ zIndex: 0 }}>
        <PixelBlast
          variant="circle"
          pixelSize={4}
          color="#DC143C"
          patternScale={1.5}
          patternDensity={1.3}
          pixelSizeJitter={0.5}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid={false}
          liquidStrength={0.12}
          liquidRadius={1.2}
          liquidWobbleSpeed={5}
          speed={0.6}
          edgeFade={0.1}
          transparent
          autoPauseOffscreen={false}
          style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}
        />
      </div>
      
      {/* Hero Content */}
      <div className="relative" style={{ zIndex: 10 }} >
        <div className="flex min-h-screen items-center justify-center">
          <h1 className="text-4xl font-normal text-white">Hello World</h1>
        </div>
      </div>
    </div>
  );
}
