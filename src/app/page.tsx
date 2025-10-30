import TopBar from "@/components/TopBar";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col text-white">
      <TopBar />
      <div className="flex flex-1 flex-col items-center justify-center px-4">
      <h1 className="text-5xl font-bold mb-4 drop-shadow-md text-center">Physics 15c Project</h1>
      <p className="text-xl opacity-80 mb-8 max-w-xl text-center">Welcome to my Physics 15c project! Explore concepts, simulations, and visualizations about electromagnetism, waves, and much more. Get started below!</p>
      {/* Add more homepage links or showcase components here if desired */}
      </div>
    </main>
  );
}
