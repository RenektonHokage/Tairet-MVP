import React from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export interface FilterOption {
  id: string;
  label: string;
  checked?: boolean;
}

export interface FilterGroup {
  id: string;
  label: string;
  type: 'select' | 'checkbox' | 'multiselect';
  options: FilterOption[];
  value?: string | string[];
}

export type FilterValue = string | string[] | { optionId: string; checked: boolean };

interface FilterSheetProps {
  filters: FilterGroup[];
  onFilterChange: (groupId: string, value: FilterValue) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
}

/**
 * Reusable filter sheet component
 * Reduces duplication across AllBars, AllClubs, and other filtered lists
 */
const FilterSheet: React.FC<FilterSheetProps> = ({
  filters,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  isOpen,
  onOpenChange,
  children
}) => {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="relative h-10 px-4">
          <Filter className="w-4 h-4 mr-2" />
          Filtros
          {hasActiveFilters && (
            <Badge 
              variant="secondary" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              !
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle>Filtros</SheetTitle>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              <X className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          )}
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {filters.map((group) => (
            <div key={group.id} className="space-y-3">
              <h3 className="font-medium text-foreground">{group.label}</h3>
              
              {group.type === 'select' && (
                <Select
                  value={group.value as string}
                  onValueChange={(value) => onFilterChange(group.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={`Seleccionar ${group.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {group.options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {group.type === 'checkbox' && (
                <div className="space-y-2">
                  {group.options.map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={option.id}
                        checked={option.checked}
                        onCheckedChange={(checked) => 
                          onFilterChange(group.id, { optionId: option.id, checked: checked === true })
                        }
                      />
                      <label
                        htmlFor={option.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {group.type === 'multiselect' && (
                <div className="space-y-2">
                  {group.options.map((option) => (
                    <div key={option.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={option.id}
                        checked={Array.isArray(group.value) && group.value.includes(option.id)}
                        onCheckedChange={(checked) => {
                          const currentValues = (group.value as string[]) || [];
                          const newValues = checked === true
                            ? [...currentValues, option.id]
                            : currentValues.filter(v => v !== option.id);
                          onFilterChange(group.id, newValues);
                        }}
                      />
                      <label
                        htmlFor={option.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FilterSheet;