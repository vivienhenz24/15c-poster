export const dynamic = 'force-static';

import TopBar from "@/components/TopBar";
import GradientBlinds from "@/components/GradientBlinds";

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col text-white overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <GradientBlinds />
      </div>
      <div className="relative z-10">
        <TopBar />
        <div className="flex flex-1 flex-col items-center justify-center px-4 min-h-[calc(100vh-56px)]">
          <label htmlFor="hero-search" className="sr-only">Search</label>
          <input
            id="hero-search"
            type="text"
            placeholder="Type here..."
            className="w-full max-w-xl rounded-md bg-white/90 text-black placeholder:text-black/60 shadow-lg ring-1 ring-white/30 focus:ring-2 focus:ring-white/60 px-6 py-4 outline-none backdrop-blur-sm"
          />
        </div>
      </div>
    </main>
  );
}
