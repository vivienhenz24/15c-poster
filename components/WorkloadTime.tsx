'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

type YearWorkloadData = {
  year: number;
  avg_hours: number;
};

type WorkloadTimeProps = {
  className?: string;
};

const WorkloadTime: React.FC<WorkloadTimeProps> = ({
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<YearWorkloadData[]>([]);

  // Load and parse CSV data
  useEffect(() => {
    const loadData = async () => {
      try {
        const csvData = await d3.csv('/data/qguide_timeseries.csv');
        
        // Group by year and calculate average hours per week
        const yearMap = new Map<number, { total: number; count: number }>();
        
        csvData.forEach((d) => {
          const year = parseInt(d.year || '0', 10);
          const hours = parseFloat(d.hours_per_week || '0');
          
          if (year > 0 && hours > 0) {
            if (!yearMap.has(year)) {
              yearMap.set(year, { total: 0, count: 0 });
            }
            const entry = yearMap.get(year)!;
            entry.total += hours;
            entry.count += 1;
          }
        });
        
        // Convert to array of YearWorkloadData
        const parsed: YearWorkloadData[] = Array.from(yearMap.entries())
          .map(([year, { total, count }]) => ({
            year,
            avg_hours: total / count,
          }))
          .sort((a, b) => a.year - b.year); // Sort chronologically

        setData(parsed);
        setLoading(false);
      } catch (err) {
        setError('Failed to load data');
        setLoading(false);
        console.error('Error loading CSV:', err);
      }
    };

    loadData();
  }, []);

  // Render bar chart visualization on canvas
  useEffect(() => {
    if (!data.length || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const displayHeight = 900;
    const displayWidth = displayHeight; // Make it square
    
    // Set internal resolution higher for high-DPI displays
    const height = displayHeight * dpr;
    const width = displayWidth * dpr;
    
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale context to account for device pixel ratio
    ctx.scale(dpr, dpr);

    // Clear canvas with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Margins
    const margin = { top: 60, right: 40, bottom: 80, left: 60 };
    const innerWidth = displayWidth - margin.left - margin.right;
    const innerHeight = displayHeight - margin.top - margin.bottom;

    // Setup scales
    const years = data.map(d => d.year);
    const maxHours = d3.max(data, d => d.avg_hours) || 10;
    
    const xScale = d3.scaleBand()
      .domain(years.map(String))
      .range([0, innerWidth])
      .paddingInner(0.2)
      .paddingOuter(0.1);
    
    const yScale = d3.scaleLinear()
      .domain([0, maxHours * 1.1]) // Add 10% padding at top
      .range([innerHeight, 0]);

    // Translate to margin area
    ctx.save();
    ctx.translate(margin.left, margin.top);

    // Draw gridlines
    const yTicks = yScale.ticks(6);
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    
    yTicks.forEach(tick => {
      const y = yScale(tick);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(innerWidth, y);
      ctx.stroke();
    });

    // Draw bars
    data.forEach((d) => {
      const barWidth = xScale.bandwidth();
      const barHeight = innerHeight - yScale(d.avg_hours);
      const x = xScale(String(d.year)) || 0;
      const y = yScale(d.avg_hours);
      
      // Draw bar with crimson color
      ctx.fillStyle = '#DC143C';
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Draw black stroke
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, barWidth, barHeight);
    });

    // Draw x-axis
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, innerHeight);
    ctx.lineTo(innerWidth, innerHeight);
    ctx.stroke();

    // Draw y-axis
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, innerHeight);
    ctx.stroke();

    // Draw x-axis labels (years)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    data.forEach((d) => {
      const x = (xScale(String(d.year)) || 0) + xScale.bandwidth() / 2;
      ctx.fillText(String(d.year), x, innerHeight + 10);
    });

    // Draw y-axis labels (hours)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    yTicks.forEach(tick => {
      const y = yScale(tick);
      ctx.fillText(tick.toFixed(1), -10, y);
    });

    // Draw axis titles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '14px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText('Year', innerWidth / 2, innerHeight + 50);
    
    ctx.save();
    ctx.translate(-40, innerHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Average Hours per Week', 0, 0);
    ctx.restore();

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Average Workload per Year', innerWidth / 2, -40);

    ctx.restore();

    // Store data for tooltip interactions
    const getBarAtPoint = (x: number, y: number) => {
      const adjustedX = x - margin.left;
      const adjustedY = y - margin.top;
      
      return data.find((d) => {
        const barX = xScale(String(d.year)) || 0;
        const barWidth = xScale.bandwidth();
        const barHeight = innerHeight - yScale(d.avg_hours);
        const barY = yScale(d.avg_hours);
        
        return adjustedX >= barX && adjustedX <= barX + barWidth &&
               adjustedY >= barY && adjustedY <= barY + barHeight;
      });
    };

    // Tooltip element
    let tooltip: HTMLDivElement | null = null;

    const showTooltip = (event: MouseEvent, yearData: YearWorkloadData) => {
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.style.position = 'absolute';
        tooltip.style.padding = '8px 12px';
        tooltip.style.background = 'rgba(0, 0, 0, 0.9)';
        tooltip.style.color = '#FFFFFF';
        tooltip.style.border = '1px solid #DC143C';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '12px';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '1000';
        document.body.appendChild(tooltip);
      }

      tooltip.style.opacity = '1';
      tooltip.style.left = `${event.pageX + 10}px`;
      tooltip.style.top = `${event.pageY - 10}px`;
      tooltip.innerHTML = `
        <strong>${yearData.year}</strong><br/>
        Avg Hours/Week: ${yearData.avg_hours.toFixed(2)}
      `;
    };

    const hideTooltip = () => {
      if (tooltip) {
        tooltip.style.opacity = '0';
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const bar = getBarAtPoint(x, y);
      if (bar) {
        showTooltip(event, bar);
      } else {
        hideTooltip();
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseout', hideTooltip);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseout', hideTooltip);
      if (tooltip) {
        document.body.removeChild(tooltip);
      }
    };
  }, [data]);

  return (
    <section className={`w-full bg-black text-white pb-8 pt-0 ${className}`}>
      <div ref={containerRef} className="w-full px-6">
        {loading && (
          <div className="flex items-center justify-center h-96">
            <p className="text-white text-lg">Loading workload data...</p>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-96">
            <p className="text-red-400 text-lg">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              style={{ display: 'block' }}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default WorkloadTime;

