import type { ReactNode } from 'react';
import { FoodContextGuide } from '@/components/food/food-context-guide';

export default function FoodLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <FoodContextGuide />
    </>
  );
}
