import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface FilterBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  options: string[];
  selectedOptions: string[];
  onToggleOption: (option: string) => void;
  onClear: () => void;
  onApply: () => void;
}

export function FilterBottomSheet({
  open,
  onOpenChange,
  title,
  options,
  selectedOptions,
  onToggleOption,
  onClear,
  onApply,
}: FilterBottomSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background">
        <DrawerHeader className="flex items-center justify-between">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {options.map(option => (
              <Badge
                key={option}
                variant={selectedOptions.includes(option) ? "default" : "outline"}
                className="cursor-pointer px-4 py-2 text-sm"
                onClick={() => onToggleOption(option)}
              >
                {option}
              </Badge>
            ))}
          </div>
        </div>

        <DrawerFooter className="flex-row gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={onClear}
          >
            Limpiar
          </Button>
          <Button 
            className="flex-1"
            onClick={() => {
              onApply();
              onOpenChange(false);
            }}
          >
            Aplicar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
