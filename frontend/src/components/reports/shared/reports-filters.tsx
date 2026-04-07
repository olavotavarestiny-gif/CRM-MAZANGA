'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { REPORT_PERIOD_OPTIONS, ReportPeriodOption } from './report-format';

interface FilterOption {
  value: string;
  label: string;
}

export function ReportsFilters({
  title,
  description,
  period,
  onPeriodChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  establishmentId,
  onEstablishmentChange,
  establishmentOptions = [],
  extraContent,
  onReset,
}: {
  title: string;
  description: string;
  period: ReportPeriodOption;
  onPeriodChange: (value: ReportPeriodOption) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  establishmentId?: string;
  onEstablishmentChange?: (value: string) => void;
  establishmentOptions?: FilterOption[];
  extraContent?: React.ReactNode;
  onReset?: () => void;
}) {
  const isCustom = period === 'custom';

  return (
    <Card className="border-[#dde3ec] shadow-sm">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="mt-2">{description}</CardDescription>
        </div>
        {onReset ? (
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            Repor filtros
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Período
            </label>
            <Select value={period} onValueChange={(value) => onPeriodChange(value as ReportPeriodOption)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleciona o período" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {onEstablishmentChange ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Estabelecimento
              </label>
              <Select value={establishmentId || 'all'} onValueChange={onEstablishmentChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os estabelecimentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os estabelecimentos</SelectItem>
                  {establishmentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {isCustom ? (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Início
                </label>
                <Input type="date" value={startDate} onChange={(event) => onStartDateChange(event.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Fim
                </label>
                <Input type="date" value={endDate} onChange={(event) => onEndDateChange(event.target.value)} />
              </div>
            </>
          ) : null}
        </div>

        {extraContent ? <div>{extraContent}</div> : null}
      </CardContent>
    </Card>
  );
}
