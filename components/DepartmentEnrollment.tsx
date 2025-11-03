'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

type DepartmentData = {
  department: string;
  total_enrollment: number;
  num_courses: number;
  avg_rating: number;
};

type DepartmentEnrollmentProps = {
  className?: string;
  maxDepartments?: number;
};

const DepartmentEnrollment: React.FC<DepartmentEnrollmentProps> = ({
  className = '',
  maxDepartments = 40,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DepartmentData[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);

  // Load and parse CSV data
  useEffect(() => {
    const loadData = async () => {
      try {
        const csvData = await d3.csv('/data/qguide_departments.csv');
        
        const parsed = csvData
          .map((d) => ({
            department: d.department || '',
            total_enrollment: parseInt(d.total_enrollment || '0', 10),
            num_courses: parseInt(d.num_courses || '0', 10),
            avg_rating: parseFloat(d.avg_rating || '0'),
          }))
          .filter((d) => d.total_enrollment > 0)
          .sort((a, b) => b.total_enrollment - a.total_enrollment)
          .slice(0, maxDepartments);

        setData(parsed);
        setLoading(false);
      } catch (err) {
        setError('Failed to load data');
        setLoading(false);
        console.error('Error loading CSV:', err);
      }
    };

    loadData();
  }, [maxDepartments]);

  // Track container width for responsive rendering
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.getBoundingClientRect().width);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Render visualization
  useEffect(() => {
    if (!data.length || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    const width = containerWidth || rect.width;
    const height = Math.max(600, data.length * 35 + 100);
    
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Margins
    const margin = { top: 40, right: 120, bottom: 60, left: 200 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Scales
    const maxEnrollment = d3.max(data, (d) => d.total_enrollment) || 1;
    const xScale = d3.scaleLinear().domain([0, maxEnrollment]).range([0, innerWidth]);
    const yScale = d3.scaleBand()
      .domain(data.map((d) => d.department))
      .range([0, innerHeight])
      .padding(0.2);

    // Crimson color scheme
    const crimson = '#DC143C';
    const crimsonLight = '#FF6B8A';
    const crimsonDark = '#B0123A';

    // Translate to margin area
    ctx.save();
    ctx.translate(margin.left, margin.top);

    // Draw bars
    data.forEach((d, i) => {
      const barHeight = yScale.bandwidth();
      const barWidth = xScale(d.total_enrollment);
      const y = yScale(d.department) || 0;

      // Gradient for bars
      const gradient = ctx.createLinearGradient(0, y, barWidth, y);
      gradient.addColorStop(0, crimsonDark);
      gradient.addColorStop(1, crimson);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, barWidth, barHeight);

      // Bar outline
      ctx.strokeStyle = crimsonLight;
      ctx.lineWidth = 1;
      ctx.strokeRect(0, y, barWidth, barHeight);

      // Department label on the left
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.department, -10, y + barHeight / 2);

      // Enrollment value on the bar
      if (barWidth > 80) {
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.font = 'bold 12px "Helvetica Neue", Helvetica, Arial, sans-serif';
        ctx.fillText(
          d.total_enrollment.toLocaleString(),
          8,
          y + barHeight / 2
        );
      }
    });

    // Draw x-axis
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, innerHeight);
    ctx.lineTo(innerWidth, innerHeight);
    ctx.stroke();

    // X-axis ticks and labels
    const tickCount = 10;
    const ticks = xScale.ticks(tickCount);
    ticks.forEach((tick) => {
      const x = xScale(tick);
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, innerHeight);
      ctx.lineTo(x, innerHeight + 5);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '11px "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(tick.toLocaleString(), x, innerHeight + 8);
    });

    // X-axis label
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Total Enrollment', innerWidth / 2, innerHeight + 45);

    // Y-axis line
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, innerHeight);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Student Enrollment by Department', innerWidth / 2, -25);

    ctx.restore();
  }, [data, containerWidth]);

  return (
    <section className={`w-full bg-black text-white pb-12 pt-0 ${className}`}>
      <div ref={containerRef} className="w-full px-6">
        {loading && (
          <div className="flex items-center justify-center h-96">
            <p className="text-white text-lg">Loading enrollment data...</p>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-96">
            <p className="text-red-400 text-lg">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <canvas
            ref={canvasRef}
            className="w-full h-auto"
            style={{ display: 'block' }}
          />
        )}
      </div>
    </section>
  );
};

export default DepartmentEnrollment;

