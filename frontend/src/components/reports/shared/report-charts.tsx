'use client';

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3 } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

function hasData(values: Array<number | null | undefined>) {
  return values.some((value) => Number(value || 0) > 0);
}

export function ReportsBarChart({
  labels,
  values,
  datasetLabel,
  color = 'rgba(15, 23, 42, 0.85)',
}: {
  labels: string[];
  values: Array<number | null | undefined>;
  datasetLabel: string;
  color?: string;
}) {
  if (!hasData(values)) {
    return (
      <EmptyState
        compact
        icon={BarChart3}
        title="Sem dados suficientes"
        description="Ainda não há volume suficiente neste período para desenhar o gráfico."
      />
    );
  }

  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: datasetLabel,
            data: values,
            backgroundColor: color,
            borderRadius: 10,
            maxBarThickness: 48,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.15)',
            },
          },
        },
      }}
    />
  );
}

export function ReportsLineChart({
  labels,
  values,
  datasetLabel,
  color = 'rgb(37, 99, 235)',
}: {
  labels: string[];
  values: Array<number | null | undefined>;
  datasetLabel: string;
  color?: string;
}) {
  if (!hasData(values)) {
    return (
      <EmptyState
        compact
        icon={BarChart3}
        title="Sem tendência para mostrar"
        description="Quando houver movimento suficiente neste período, o gráfico temporal aparece aqui."
      />
    );
  }

  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: datasetLabel,
            data: values,
            borderColor: color,
            backgroundColor: `${color}22`,
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 4,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(148, 163, 184, 0.15)',
            },
          },
        },
      }}
    />
  );
}

export function ReportsDoughnutChart({
  labels,
  values,
  colors,
}: {
  labels: string[];
  values: Array<number | null | undefined>;
  colors: string[];
}) {
  if (!hasData(values)) {
    return (
      <EmptyState
        compact
        icon={BarChart3}
        title="Sem distribuição para mostrar"
        description="Não há dados suficientes para calcular a distribuição neste período."
      />
    );
  }

  return (
    <Doughnut
      data={{
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
            },
          },
        },
        cutout: '68%',
      }}
    />
  );
}
