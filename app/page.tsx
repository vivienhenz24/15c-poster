'use client';

// Component inspired by github.com/zavalit/bayer-dithering-webgl-demo

import PixelBlast from '@/components/PixelBlast';
import TopBar from '@/components/TopBar';
import DepartmentEnrollment from '@/components/DepartmentEnrollment';

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen bg-black text-white">
      <TopBar />
      <section className="flex flex-col w-full items-center justify-center px-6 min-h-[600px] py-16">
        <div style={{ width: '100%', height: '600px', position: 'relative' }}>
          <PixelBlast
            variant="diamond"
            pixelSize={6}
            color="#DC143C"
            patternScale={3}
            patternDensity={2.1}
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
            edgeFade={0.25}
           
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {/* Subtle dark backdrop for text area */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/40" />
            
            <div className="relative z-10 flex flex-col items-center">
              <h1 className="text-5xl font-normal md:text-6xl max-w-3xl px-6 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] text-center">How AI has reshaped Harvard students work</h1>
              <p className="mt-6 text-lg font-normal text-white max-w-2xl px-6 leading-relaxed drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] text-center">
                An exploration of Qguide data analyzing course workloads patterns over time, with a focus on how the introduction of AI tools have affected them.
              </p>
            </div>
          </div>
          {/* Bottom banner with names */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center pb-4 pointer-events-none translate-y-18">
            <div className="flex items-center justify-center gap-6 text-white text-sm font-normal drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              <span>Kirthi Chigurupati</span>
              <span>Yasmine Moussa</span>
              <span>Said El Kadi</span>
              <span>Vivien Henz</span>
            </div>
          </div>
        </div>
      </section>
      <div className="mt-32 mb-8">
        <DepartmentEnrollment />
      </div>
    </main>
  );
}
