import React from "react";
import TopBar from "@/components/TopBar";
import GradientBlinds from "@/components/GradientBlinds";

export default function TechniquesPage() {
  return (
    <main className="relative min-h-screen flex flex-col text-white overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-60">
        <GradientBlinds />
      </div>
      <div className="relative z-10">
        <TopBar />
        <div className="p-8 flex-1 flex flex-col items-center">
          <table className="w-[900px] table-fixed text-black text-lg border border-black bg-white rounded-lg overflow-hidden shadow-xl">
            <colgroup>
              <col className="w-1/3" />
              <col className="w-1/3" />
              <col className="w-1/3" />
            </colgroup>
            <thead>
              <tr>
                <th className="px-12 py-6 text-center">Transform Domain Coefficient Embedding</th>
                <th className="px-12 py-6 text-center">Spread Spectrum</th>
                <th className="px-12 py-6 text-center">Quantization Index Modulation</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t-4 border-black">
                <td className="px-12 py-8 text-center">Row 1, Col 1</td>
                <td className="px-12 py-8 text-center">Row 1, Col 2</td>
                <td className="px-12 py-8 text-center">Row 1, Col 3</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
