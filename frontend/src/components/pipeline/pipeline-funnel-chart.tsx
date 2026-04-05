'use client';

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { PipelineAnalyticsConversionStage } from '@/lib/types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface PipelineFunnelChartProps {
  stages: PipelineAnalyticsConversionStage[];
}

export default function PipelineFunnelChart({ stages }: PipelineFunnelChartProps) {
  const chartStages = stages.filter((stage) => stage.stage !== 'Perdido');

  return (
    <div className="h-[320px]">
      <Bar
        data={{
          labels: chartStages.map((stage) => stage.stage),
          datasets: [
            {
              label: '% de avanço',
              data: chartStages.map((stage) => stage.advancementRate || 0),
              backgroundColor: chartStages.map((stage) => stage.color),
              borderRadius: 8,
              borderSkipped: false,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            legend: {
              display: false,
            },
            tooltip: {
              callbacks: {
                label: (context) => `${Number(context.raw || 0).toFixed(1)}%`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: (value) => `${value}%`,
                color: '#6b7e9a',
              },
              grid: {
                color: '#eef2f7',
              },
            },
            y: {
              ticks: {
                color: '#0A2540',
              },
              grid: {
                display: false,
              },
            },
          },
        }}
      />
    </div>
  );
}
