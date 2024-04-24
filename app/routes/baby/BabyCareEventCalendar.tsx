import type { SerializeFrom } from "@remix-run/node";
import {
  type BabyCareProfile,
  type BabyCareCalendarEvent,
} from "../../data/BabyCare";
import {
  DateCalendar,
  PickersDay,
  type PickersDayProps,
} from "@mui/x-date-pickers";
import { Badge } from "@mui/material";
import { format, isSameDay, isSameMonth, parse, startOfMonth } from "date-fns";
import { useState } from "react";
import { useSearchParams } from "@remix-run/react";

type CalendarDayDisplayProps = {
  eventsByDay?: Map<number, SerializeFrom<BabyCareCalendarEvent>[]>;
  selectedDate?: Date;
};

function CalendarDayDisplay(
  props: PickersDayProps<Date> & CalendarDayDisplayProps
) {
  const {
    eventsByDay = new Map(),
    selectedDate = new Date(),
    day,
    outsideCurrentMonth,
    ...other
  } = props;

  const hasEvents =
    !props.outsideCurrentMonth && eventsByDay.has(props.day.getDate());
  const events = eventsByDay.get(props.day.getDate()) ?? [];

  return (
    <Badge
      key={props.day.toString()}
      classes={{
        badge:
          hasEvents && isSameDay(day, selectedDate)
            ? "bg-yellow-500"
            : "text-2xs bg-yellow-500 rounded-full px-1 min-w-4 h-4 select-none text-white",
      }}
      overlap="circular"
      variant={hasEvents && isSameDay(day, selectedDate) ? "dot" : "standard"}
      badgeContent={
        hasEvents && !isSameDay(day, selectedDate) ? events.length : undefined
      }
      max={9}
    >
      <PickersDay
        {...other}
        outsideCurrentMonth={outsideCurrentMonth}
        day={day}
        classes={{
          selected: "bg-blue-500",
          today: "border-blue-400",
        }}
      />
    </Badge>
  );
}

export const BabyCareEventCalendar = (props: {
  events: SerializeFrom<BabyCareCalendarEvent>[];
  profile: SerializeFrom<BabyCareProfile>;
}) => {
  const { events } = props;
  const eventsByDay = events.reduce((acc, event) => {
    if (!acc.has(event.day)) {
      acc.set(event.day, []);
    }
    acc.get(event.day)?.push(event);
    return acc;
  }, new Map());

  const [searchParams, setSearchParams] = useSearchParams();
  const month = searchParams.has("month")
    ? parse(searchParams.get("month") ?? "", "MM-yyyy", new Date())
    : startOfMonth(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    isSameMonth(month, new Date()) ? new Date() : startOfMonth(month)
  );
  const selectedDateEvents: SerializeFrom<BabyCareCalendarEvent>[] =
    selectedDate ? eventsByDay.get(selectedDate.getDate()) ?? [] : [];
  const handleTimeFrameChange = (newDate: Date) => {
    if (!isSameMonth(newDate, month)) {
      if (isSameMonth(newDate, new Date())) {
        setSearchParams((params) => {
          params.delete("month");
          return params;
        });
      } else {
        setSearchParams((params) => {
          params.set("month", format(newDate, "MM-yyyy"));
          return params;
        });
      }
    }
  };

  return (
    <div className="w-full px-4 py-2 flex justify-center">
      <div className="w-[370px] p-4 rounded bg-white my-2 shadow-md">
        <div>
          <DateCalendar
            value={selectedDate}
            onMonthChange={handleTimeFrameChange}
            onYearChange={handleTimeFrameChange}
            onChange={(date) => setSelectedDate(date)}
            slots={{
              day: CalendarDayDisplay,
            }}
            slotProps={{
              day: {
                eventsByDay,
                selectedDate,
              } as any,
            }}
          />
        </div>
        <div className="px-2 space-y-2">
          {selectedDateEvents.map((event) => {
            const distanceInYear = month.getFullYear() - event.year;
            return (
              <div
                key={event.id}
                className="flex rounded h-8 bg-slate-100 shadow-sm pl-4 pr-2 items-center text-sm select-none"
              >
                <div
                  className="w-full text-ellipsis overflow-x-hidden whitespace-nowrap pr-2"
                  title={`${format(event.time, "[yyyy-MM-dd HH:mm]")} ${
                    event.title ?? "Untitled"
                  }${event.description ? `\n${event.description}` : ""}`}
                >
                  {event.title ?? event.description ? (
                    event.title ?? event.description
                  ) : (
                    <i>Untitled</i>
                  )}
                </div>
                {distanceInYear > 0 && (
                  <div className="flex items-center justify-center rounded h-4 px-2 bg-slate-200 text-2xs font-medium">
                    {distanceInYear}y
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
