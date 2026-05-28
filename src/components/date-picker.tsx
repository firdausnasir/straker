"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

function format(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

// Single-date picker built from shadcn's Popover + Calendar (the recommended
// composition — there is no DatePicker root). Closes on select.
// Year-dropdown range. react-day-picker (v10) restricts the dropdown to a
// single year unless startMonth/endMonth are set. Commitments include
// long-running loans, so we open a generous window: 5y back (for backdating an
// existing overdue item) → 50y forward (covers mortgages and the like).
const YEARS_BACK = 5;
const YEARS_FORWARD = 50;

export function DatePicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: Date | undefined;
  onChange: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const startMonth = new Date(today.getFullYear() - YEARS_BACK, 0, 1);
  const endMonth = new Date(today.getFullYear() + YEARS_FORWARD, 11, 1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className={cn(
          "field flex w-full items-center justify-between text-left",
          !value && "text-muted-foreground",
        )}
      >
        <span className="tnum">{value ? format(value) : "Pick a date"}</span>
        <CalendarIcon className="h-[18px] w-[18px] opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
          onSelect={(date) => {
            if (date) {
              onChange(date);
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
