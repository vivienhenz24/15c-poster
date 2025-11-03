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
  maxDepartments = 50,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DepartmentData[]>([]);

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
          .filter((d) => d.total_enrollment > 0 && d.department !== 'GENED') // Remove GENED
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

  // Render treemap visualization on canvas
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

    // Clear canvas with black background (now using display dimensions)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Margins (using display dimensions)
    const margin = { top: 40, right: 20, bottom: 20, left: 20 };
    const innerWidth = displayWidth - margin.left - margin.right;
    const innerHeight = displayHeight - margin.top - margin.bottom;

    // Prepare hierarchical data for treemap
    // D3 hierarchy expects children array directly
    const root = d3.hierarchy({ children: data } as { children: DepartmentData[] })
      .sum((d: unknown) => {
        // The sum function receives the data object
        // For leaf nodes (DepartmentData), it has total_enrollment
        // For parent nodes, it has children array
        const item = d as DepartmentData | { children: DepartmentData[] };
        if ('total_enrollment' in item) {
          return (item as DepartmentData).total_enrollment;
        }
        return 0; // Parent nodes don't have values
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    const treemap = d3.treemap()
      .size([innerWidth, innerHeight])
      .paddingInner(2)
      .paddingOuter(2)
      .round(true);

    treemap(root as d3.HierarchyNode<unknown>);

    // Color scale - inverted: darkest = most enrollment
    const maxEnrollment = d3.max(data, (d) => d.total_enrollment) || 1;
    const colorScale = d3.scaleSequential((t) => {
      // Inverted: light crimson (low enrollment) to dark crimson (high enrollment)
      const light = d3.rgb(255, 107, 138); // Light crimson #FF6B8A
      const dark = d3.rgb(176, 18, 58); // Dark crimson #B0123A
      return d3.interpolateRgb(light, dark)(t);
    }).domain([0, maxEnrollment]);

    // Translate to margin area
    ctx.save();
    ctx.translate(margin.left, margin.top);

    // Draw rectangles - after treemap layout, nodes have x0, y0, x1, y1 properties
    const leaves = root.leaves();
    
    if (leaves.length === 0) {
      console.error('No leaves found in treemap');
      ctx.restore();
      return;
    }
    
    leaves.forEach((node) => {
      // The data property contains the DepartmentData for leaf nodes
      const treemapNode = node as unknown as d3.HierarchyRectangularNode<DepartmentData>;
      const deptData = treemapNode.data as DepartmentData;
      
      // Get coordinates from treemap layout
      const x0 = treemapNode.x0;
      const y0 = treemapNode.y0;
      const x1 = treemapNode.x1;
      const y1 = treemapNode.y1;
      
      const rectWidth = x1 - x0;
      const rectHeight = y1 - y0;
      const area = rectWidth * rectHeight;

      // Get color from scale
      const color = colorScale(deptData.total_enrollment);
      const rgb = d3.rgb(color);

      // Draw rectangle
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.fillRect(x0, y0, rectWidth, rectHeight);

      // Draw black stroke
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0, y0, rectWidth, rectHeight);

      // Add labels if rectangle is large enough
      if (area > 2000) {
        // Department name
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.min(rectWidth / 10, 16)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          deptData.department,
          x0 + rectWidth / 2,
          y0 + rectHeight / 2 - 8
        );

        // Enrollment value
        ctx.font = `${Math.min(rectWidth / 12, 12)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(
          deptData.total_enrollment.toLocaleString(),
          x0 + rectWidth / 2,
          y0 + rectHeight / 2 + 12
        );
      } else if (area > 500) {
        // Just department name for medium rectangles
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.min(rectWidth / 8, 12)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
        ctx.fillText(
          deptData.department,
          x0 + rectWidth / 2,
          y0 + rectHeight / 2
        );
      }
    });

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Student Enrollment by Department', innerWidth / 2, -20);

      ctx.restore();

    // Store data for tooltip interactions
    const getCellAtPoint = (x: number, y: number) => {
      // Adjust for margins
      const adjustedX = x - margin.left;
      const adjustedY = y - margin.top;
      
      return leaves.find((node) => {
        const treemapNode = node as unknown as d3.HierarchyRectangularNode<DepartmentData>;
        const x0 = treemapNode.x0;
        const y0 = treemapNode.y0;
        const x1 = treemapNode.x1;
        const y1 = treemapNode.y1;
        return adjustedX >= x0 && adjustedX <= x1 &&
               adjustedY >= y0 && adjustedY <= y1;
      });
    };

    // Tooltip element
    let tooltip: HTMLDivElement | null = null;

    const showTooltip = (event: MouseEvent, deptData: DepartmentData) => {
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
        <strong>${deptData.department}</strong><br/>
        Enrollment: ${deptData.total_enrollment.toLocaleString()}<br/>
        Courses: ${deptData.num_courses}<br/>
        Avg Rating: ${deptData.avg_rating.toFixed(2)}
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

      const cell = getCellAtPoint(x, y);
      if (cell) {
        const treemapNode = cell as unknown as d3.HierarchyRectangularNode<DepartmentData>;
        showTooltip(event, treemapNode.data as DepartmentData);
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
            <p className="text-white text-lg">Loading enrollment data...</p>
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

export default DepartmentEnrollment;
