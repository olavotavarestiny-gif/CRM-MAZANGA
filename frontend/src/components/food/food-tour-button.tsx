'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCompletedFoodTours, startFoodTour } from '@/lib/food-tours';
import type { FoodTourId } from '@/lib/food-tours';

export function FoodTourButton({
  tourId,
  userId,
  variant = 'outline',
  className,
}: {
  tourId: FoodTourId;
  userId?: number;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  className?: string;
}) {
  const [completed, setCompleted] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setCompleted(getCompletedFoodTours(userId).includes(tourId));
  }, [tourId, userId]);

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      disabled={!userId || starting}
      onClick={async () => {
        if (!userId) return;
        setStarting(true);
        try {
          await startFoodTour(tourId, userId, () => setCompleted(true));
        } finally {
          setStarting(false);
        }
      }}
    >
      {completed ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : <Map className="mr-2 h-4 w-4" />}
      {starting ? 'A preparar...' : completed ? 'Repetir visita' : 'Visita guiada'}
    </Button>
  );
}
