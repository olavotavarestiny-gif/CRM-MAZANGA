'use client';

import { memo } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormField } from '@/lib/types';

interface FormFieldListProps {
  fields: FormField[];
  selectedFieldId: string | null;
  isAddingField: boolean;
  onAddField: () => void;
  onDragEnd: (result: DropResult) => void;
  onSelectField: (fieldId: string) => void;
}

interface FormFieldListItemProps {
  field: FormField;
  index: number;
  isSelected: boolean;
  onSelectField: (fieldId: string) => void;
}

const FormFieldListItem = memo(function FormFieldListItem({
  field,
  index,
  isSelected,
  onSelectField,
}: FormFieldListItemProps) {
  return (
    <Draggable draggableId={field.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
            isSelected
              ? 'border-[#0A2540] bg-[#F8FAFC]'
              : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]'
          }`}
          onClick={() => onSelectField(field.id)}
        >
          <div className="flex items-center gap-2">
            <div {...provided.dragHandleProps} className="text-[#6b7e9a]">
              <GripVertical className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#0A2540] truncate font-medium">{field.label}</p>
              <p className="text-xs text-[#6b7e9a]">{field.type === 'text' ? 'Texto' : 'Múltipla Escolha'}</p>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
});

export const FormFieldList = memo(function FormFieldList({
  fields,
  selectedFieldId,
  isAddingField,
  onAddField,
  onDragEnd,
  onSelectField,
}: FormFieldListProps) {
  return (
    <Card className="col-span-1 border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Campos ({fields.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="fields">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`space-y-2 min-h-48 ${snapshot.isDraggingOver ? 'bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-2' : ''}`}
              >
                {fields.map((field, index) => (
                  <FormFieldListItem
                    key={field.id}
                    field={field}
                    index={index}
                    isSelected={selectedFieldId === field.id}
                    onSelectField={onSelectField}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <Button onClick={onAddField} className="w-full" variant="outline" disabled={isAddingField}>
          <Plus className="w-4 h-4 mr-2" /> Adicionar Campo
        </Button>
      </CardContent>
    </Card>
  );
});
