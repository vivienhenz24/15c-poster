'use client';

// Component inspired by github.com/zavalit/bayer-dithering-webgl-demo

import PixelBlast from '../components/PixelBlast';

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black text-white">
      <section className="flex w-full items-center justify-center px-6">
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
            <span className="mb-4 text-sm uppercase tracking-[0.3em] text-white/70">
              Welcome to PixelBlast
            </span>
            <h1 className="text-5xl font-semibold md:text-6xl">Hello World</h1>
            <p className="mt-4 max-w-xl text-lg text-white/70">
              Experience a dynamic, interactive hero powered by WebGL dithering effects.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
