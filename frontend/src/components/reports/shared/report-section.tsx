'use client';

import { AlertTriangle, LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ReportSectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-[#dde3ec] shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription className="mt-2">{description}</CardDescription> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

export function ReportSectionSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <Card className="border-[#dde3ec] shadow-sm">
      <CardHeader>
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-64 animate-pulse rounded bg-slate-100" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </CardContent>
    </Card>
  );
}

export function ReportNotice({
  icon: Icon = AlertTriangle,
  title,
  message,
}: {
  icon?: LucideIcon;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-white p-2">
          <Icon className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-amber-800">{message}</p>
        </div>
      </div>
    </div>
  );
}
