import { AgGridReact } from "@ag-grid-community/react";
import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
  DiaperChangeEvent,
} from "../../data/baby-care";
import { ClientSideRowModelModule } from "@ag-grid-community/client-side-row-model";
import { add, format, formatISO, isEqual, startOfDay, sub } from "date-fns";
import {
  BathIcon,
  BottleIcon,
  BreastPumpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChildToyIcon,
  NursingIcon,
  PeeIcon,
  PoopIcon,
  SleepIcon,
} from "../../shared/Icons";
import type { ICellRendererParams } from "@ag-grid-community/core";
import { useState } from "react";
import { groupBy, merge } from "lodash-es";
import { MobileDatePicker } from "@mui/x-date-pickers";
import { cn } from "../../shared/StyleUtils";
import { useSubmit } from "@remix-run/react";
import { HttpMethod } from "../../shared/NetworkUtils";

const EventTypeRenderer = (
  params: ICellRendererParams<SerializeFrom<BabyCareEvent>>
) => {
  const data = params.data;
  return (
    <div className="flex items-center h-full w-full">
      {data?.type === BabyCareEventType.BOTTLE_FEED && (
        <BottleIcon className="h-full" />
      )}
      {data?.type === BabyCareEventType.NURSING && (
        <NursingIcon className="h-full" />
      )}
      {data?.type === BabyCareEventType.PUMPING && (
        <BreastPumpIcon className="h-full" />
      )}
      {data?.type === BabyCareEventType.DIAPER_CHANGE &&
        ((data as SerializeFrom<DiaperChangeEvent>).poop ? (
          <PoopIcon className="h-full" />
        ) : (
          <PeeIcon className="h-full" />
        ))}
      {data?.type === BabyCareEventType.SLEEP && (
        <SleepIcon className="h-full" />
      )}
      {data?.type === BabyCareEventType.PLAY && (
        <ChildToyIcon className="h-full" />
      )}
      {data?.type === BabyCareEventType.BATH && <BathIcon className="h-full" />}
      {data && (
        <div className="flex items-center justify-center rounded uppercase ml-2 text-2xs font-medium leading-4 bg-slate-100 px-1 text-slate-500">
          {data.type === BabyCareEventType.DIAPER_CHANGE
            ? (data as SerializeFrom<DiaperChangeEvent>).poop
              ? BabyCareEventType.__POOP
              : BabyCareEventType.__PEE
            : data.type}
        </div>
      )}
    </div>
  );
};

const EventActionRenderer = (
  params: ICellRendererParams<SerializeFrom<BabyCareEvent>>
) => {
  const data = params.data;
  return <div className="flex items-center h-full w-full"></div>;
};

export const BabyCareEventViewer = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  events: SerializeFrom<BabyCareEvent>[];
}) => {
  const { profile, events } = props;
  const submit = useSubmit();
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(
    undefined
  );
  const [selectedDate, _setSelectedDate] = useState<Date>(
    startOfDay(new Date())
  );
  const setSelectedDate = (date: Date) => {
    submit(
      isEqual(date, startOfDay(new Date()))
        ? {}
        : { date: format(date, "yyyy-MM-dd") },
      {
        method: HttpMethod.GET,
      }
    );
    _setSelectedDate(startOfDay(date));
  };

  return (
    <div className="w-screen home__event-grid">
      <div className="flex items-center w-full bg-slate-100 border-t overflow-x-auto overflow-y-hidden">
        <div className="h-10 w-auto flex items-center px-2">
          <button
            className="text-slate-500 hover:text-slate-600"
            onClick={() =>
              setSelectedDate(sub(startOfDay(selectedDate), { days: 1 }))
            }
          >
            <ChevronLeftIcon />
          </button>
          <MobileDatePicker
            slotProps={{
              textField: {
                InputProps: {
                  classes: {
                    input: "py-0 px-2 w-16 h-7 text-slate-600 cursor-pointer",
                    notchedOutline:
                      "border-2 border-slate-200 hover:border-slate-300",
                  },
                },
              },
            }}
            value={selectedDate}
            onAccept={(value: Date | null) => {
              setSelectedDate(startOfDay(value ?? new Date()));
            }}
            format="MMM dd"
          />
          <button
            className="text-slate-500 hover:text-slate-600"
            onClick={() =>
              setSelectedDate(add(startOfDay(selectedDate), { days: 1 }))
            }
          >
            <ChevronRightIcon />
          </button>
          <button
            className={cn(
              "h-7 flex items-center px-2 rounded border-2 border-slate-200 hover:border-slate-300 ml-1",
              {
                "bg-blue-100": isEqual(selectedDate, startOfDay(new Date())),
                "border-blue-500": isEqual(
                  selectedDate,
                  startOfDay(new Date())
                ),
                "hover:border-blue-500": isEqual(
                  selectedDate,
                  startOfDay(new Date())
                ),
              }
            )}
            onClick={() => setSelectedDate(startOfDay(new Date()))}
          >
            <div className="font-medium text-slate-600 text-2xs">TODAY</div>
          </button>
        </div>
        <div className="h-10 w-full flex items-center px-2 border-l">
          <button
            className={cn(
              "h-7 flex items-center px-2 rounded border-2 border-slate-200 hover:border-slate-300",
              {
                "bg-blue-100": selectedEvent === undefined,
                "border-blue-500": selectedEvent === undefined,
                "hover:border-blue-500": selectedEvent === undefined,
              }
            )}
            onClick={() => setSelectedEvent(undefined)}
          >
            <div className="font-medium text-slate-600 text-sm">ALL</div>
            <div className="rounded  text-slate-100 bg-slate-600 text-2xs font-semibold px-1 h-4 flex items-center justify-center ml-1">
              {events.length}
            </div>
          </button>
          {Object.entries(
            merge(
              {
                [BabyCareEventType.BOTTLE_FEED]: 0,
                [BabyCareEventType.PUMPING]: 0,
                [BabyCareEventType.__POOP]: 0,
                [BabyCareEventType.__PEE]: 0,
                [BabyCareEventType.SLEEP]: 0,
                [BabyCareEventType.BATH]: 0,
                [BabyCareEventType.PLAY]: 0,
                [BabyCareEventType.NURSING]: 0,
              },
              groupBy(events, (event) =>
                event.type === BabyCareEventType.DIAPER_CHANGE
                  ? (event as SerializeFrom<DiaperChangeEvent>).poop
                    ? BabyCareEventType.__POOP
                    : BabyCareEventType.__PEE
                  : event.type
              )
            )
          ).map(([type, items]) => (
            <button
              key={type}
              onClick={() => setSelectedEvent(type)}
              className={cn(
                "h-7 flex items-center px-2 rounded border-2 border-slate-200 hover:border-slate-300 ml-1",
                {
                  "bg-blue-100": selectedEvent === type,
                  "border-blue-500": selectedEvent === type,
                  "hover:border-blue-500": selectedEvent === type,
                }
              )}
            >
              <div className="h-full flex items-center justify-center">
                {type === BabyCareEventType.BOTTLE_FEED && (
                  <BottleIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.NURSING && (
                  <NursingIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.PUMPING && (
                  <BreastPumpIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.__PEE && (
                  <PeeIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.__POOP && (
                  <PoopIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.SLEEP && (
                  <SleepIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.PLAY && (
                  <ChildToyIcon className="home__event-grid__action-icon" />
                )}
                {type === BabyCareEventType.BATH && (
                  <BathIcon className="home__event-grid__action-icon" />
                )}
              </div>
              <div className="rounded  text-slate-100 bg-slate-600 text-2xs font-semibold px-1 h-4 flex items-center justify-center ml-1">
                {items.length ?? 0}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="ag-theme-quartz ">
        <AgGridReact
          headerHeight={0}
          gridOptions={{
            getRowId: (data) => data.data.id,
          }}
          columnDefs={[
            {
              headerName: "Time",
              field: "time",
              resizable: false,
              width: 65,
              cellStyle: { textAlign: "center" },
              suppressSizeToFit: true,
              valueFormatter: (params) =>
                format(new Date(params.value), "HH:mm"),
            },
            {
              headerName: "Type",
              field: "time",
              sortable: false,
              resizable: false,
              width: 100,
              suppressSizeToFit: true,
              cellRenderer: EventTypeRenderer,
            },
            {
              headerName: "Action",
              field: "time",
              sortable: false,
              resizable: false,
              flex: 1,
              cellRenderer: EventActionRenderer,
            },
          ]}
          domLayout="autoHeight"
          rowData={events.filter((event) => {
            switch (selectedEvent) {
              case undefined:
                return true;
              case BabyCareEventType.__POOP:
                return (
                  event.type === BabyCareEventType.DIAPER_CHANGE &&
                  (event as SerializeFrom<DiaperChangeEvent>).poop
                );
              case BabyCareEventType.__PEE:
                return (
                  event.type === BabyCareEventType.DIAPER_CHANGE &&
                  !(event as SerializeFrom<DiaperChangeEvent>).poop
                );
              default:
                return event.type === selectedEvent;
            }
          })}
          modules={[ClientSideRowModelModule]}
        ></AgGridReact>
      </div>
    </div>
  );
};
