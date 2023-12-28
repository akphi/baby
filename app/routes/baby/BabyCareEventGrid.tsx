import { AgGridReact } from "@ag-grid-community/react";
import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
  type BottleFeedEvent,
  type DiaperChangeEvent,
  type NursingEvent,
  type PumpingEvent,
  BabyCareAction,
} from "../../data/baby-care";
import { ClientSideRowModelModule } from "@ag-grid-community/client-side-row-model";
import { add, format, isEqual, parseISO, startOfDay, sub } from "date-fns";
import {
  AddIcon,
  BathIcon,
  BottleIcon,
  BreastPumpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChildToyIcon,
  MoreVertIcon,
  NursingIcon,
  PeeIcon,
  PoopIcon,
  RemoveIcon,
  SleepIcon,
} from "../../shared/Icons";
import type { ICellRendererParams } from "@ag-grid-community/core";
import { useMemo, useState } from "react";
import { debounce, groupBy, merge } from "lodash-es";
import { MobileDatePicker } from "@mui/x-date-pickers";
import { cn } from "../../shared/StyleUtils";
import { useSearchParams, useSubmit } from "@remix-run/react";
import { HttpMethod } from "../../shared/NetworkUtils";
import { useBooleanSetting } from "../../storage";
import { BabyCareEventEditor } from "./BabyCareEventEditor";
import { isNonNullable } from "../../shared/AssertionUtils";

const InlineNumberInput = (props: {
  value: number;
  setValue: (value: number) => void;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  factor?: number;
  className?: string;
  children?: React.ReactNode;
}) => {
  const { min, max, step, unit, factor, value, setValue, className, children } =
    props;
  const _value = isNonNullable(value) ? value / (factor ?? 1) : undefined;
  const _setValue = (value: number) => {
    const _min = min ?? 0;
    const _max = max ?? Number.MAX_SAFE_INTEGER;
    setValue(Math.max(_min, Math.min(_max, value)) * (factor ?? 1));
  };

  return (
    <div
      className={cn(
        "h-6 w-22 shrink-0 flex justify-center items-center text-slate-600 bg-slate-100 rounded relative",
        className
      )}
    >
      <button
        className="absolute h-full w-1/2 flex justify-start items-center pl-1 left-0"
        // NOTE: suppress double click row event of ag-grid, which we cannot stop propagation with React
        // since React wraps native event
        // See https://stackoverflow.com/a/63968681
        ref={(ref) => {
          if (!ref) {
            return;
          }
          ref.ondblclick = (e) => {
            e.stopPropagation();
          };
        }}
        onClick={() => _setValue((_value ?? 0) - (step ?? 1))}
      >
        <RemoveIcon className="text-2xs" />
      </button>
      <div className="w-full h-full flex rounded justify-center items-center">
        {children}
        <div className="flex items-center font-mono text-xs">{_value}</div>
        <div className="flex items-center font-mono text-2xs ml-0.5">
          {unit}
        </div>
      </div>
      <button
        className="absolute h-full w-1/2 flex justify-end items-center pr-1 right-0"
        // NOTE: suppress double click row event of ag-grid, which we cannot stop propagation with React
        // since React wraps native event
        // See https://stackoverflow.com/a/63968681
        ref={(ref) => {
          if (!ref) {
            return;
          }
          ref.ondblclick = (e) => {
            e.stopPropagation();
          };
        }}
        onClick={() => _setValue((_value ?? 0) + (step ?? 1))}
      >
        <AddIcon className="text-2xs" />
      </button>
    </div>
  );
};

const BottleFeedEventOverview = (props: {
  data: SerializeFrom<BottleFeedEvent>;
}) => {
  const { data } = props;
  const [volume, setVolume] = useState(data.volume);
  const [useMetric] = useBooleanSetting("unit.useMetric");
  const submit = useSubmit();
  const debouncedUpdate = useMemo(
    () =>
      debounce((_volume: number) => {
        submit(
          {
            __action: BabyCareAction.UPDATE_BOTTLE_FEED_EVENT,
            ...data,
            volume: _volume,
          },
          { method: HttpMethod.POST }
        );
      }, 200),
    [submit, data]
  );

  return (
    <InlineNumberInput
      value={volume}
      unit={useMetric ? "ml" : "oz"}
      step={5}
      setValue={(value) => {
        debouncedUpdate.cancel();
        setVolume(value);
        debouncedUpdate(value);
      }}
      className="mr-2"
    />
  );
};

const PumpingEventOverview = (props: { data: SerializeFrom<PumpingEvent> }) => {
  const { data } = props;
  const [volume, setVolume] = useState(data.volume);
  const [useMetric] = useBooleanSetting("unit.useMetric");
  const submit = useSubmit();
  const debouncedUpdate = useMemo(
    () =>
      debounce((_volume: number) => {
        submit(
          {
            __action: BabyCareAction.UPDATE_PUMPING_EVENT,
            ...data,
            volume: _volume,
          },
          { method: HttpMethod.POST }
        );
      }, 200),
    [submit, data]
  );

  return (
    <InlineNumberInput
      value={volume}
      unit={useMetric ? "ml" : "oz"}
      step={5}
      setValue={(value) => {
        debouncedUpdate.cancel();
        setVolume(value);
        debouncedUpdate(value);
      }}
      className="mr-2"
    />
  );
};

const NursingEventOverview = (props: { data: SerializeFrom<NursingEvent> }) => {
  const { data } = props;
  const [leftDuration, setLeftDuration] = useState(data.leftDuration);
  const [rightDuration, setRightDuration] = useState(data.rightDuration);
  const submit = useSubmit();
  const debouncedUpdate = useMemo(
    () =>
      debounce((_leftDuration: number, _rightDuration: number) => {
        submit(
          {
            __action: BabyCareAction.UPDATE_NURSING_EVENT,
            ...data,
            leftDuration: _leftDuration,
            rightDuration: _rightDuration,
          },
          { method: HttpMethod.POST }
        );
      }, 200),
    [submit, data]
  );

  return (
    <>
      <InlineNumberInput
        value={leftDuration}
        unit={"mn"}
        factor={60 * 1000}
        step={1}
        setValue={(value) => {
          debouncedUpdate.cancel();
          setLeftDuration(value);
          debouncedUpdate(value, rightDuration);
        }}
        className="mr-2"
      >
        <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
          L
        </div>
      </InlineNumberInput>
      <InlineNumberInput
        value={rightDuration}
        unit={"mn"}
        factor={60 * 1000}
        step={1}
        setValue={(value) => {
          debouncedUpdate.cancel();
          setRightDuration(value);
          debouncedUpdate(leftDuration, value);
        }}
        className="mr-2"
      >
        <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
          R
        </div>
      </InlineNumberInput>
    </>
  );
};

const EventOverview = (props: { data: SerializeFrom<BabyCareEvent> }) => {
  const { data } = props;

  switch (data?.TYPE) {
    case BabyCareEventType.BOTTLE_FEED:
      return (
        <BottleFeedEventOverview
          data={data as SerializeFrom<BottleFeedEvent>}
        />
      );
    case BabyCareEventType.PUMPING:
      return (
        <PumpingEventOverview data={data as SerializeFrom<PumpingEvent>} />
      );
    case BabyCareEventType.NURSING:
      return (
        <NursingEventOverview data={data as SerializeFrom<NursingEvent>} />
      );
    default:
      return <></>;
  }
};

const EventOverviewRenderer = (
  params: ICellRendererParams<SerializeFrom<BabyCareEvent>> & {
    profile: SerializeFrom<BabyCareProfile>;
    setEventToEdit: (event: SerializeFrom<BabyCareEvent>) => void;
  }
) => {
  const data = params.data;
  const setEventToEdit = params.setEventToEdit;

  if (!data) {
    return null;
  }
  return (
    <div className="flex items-center h-full w-full justify-between">
      <div className="flex items-center h-full w-full overflow-x-auto overflow-y-hidden">
        <EventOverview data={data} />
        {data.comment && (
          <div className="flex items-center rounded h-6 text-2xs text-slate-600 bg-amber-100 px-2">
            {data.comment}
          </div>
        )}
      </div>
      <button
        className="flex items-center justify-center w-7 h-full"
        ref={(ref) => {
          if (!ref) {
            return;
          }
          ref.ondblclick = (e) => {
            e.stopPropagation();
          };
        }}
        onClick={() => setEventToEdit(data)}
      >
        <MoreVertIcon className="text-lg text-slate-300 hover:text-slate-500" />
      </button>
    </div>
  );
};

const EventTypeRenderer = (
  params: ICellRendererParams<SerializeFrom<BabyCareEvent>>
) => {
  const data = params.data;
  return (
    <div className="flex items-center h-full w-full">
      {data?.TYPE === BabyCareEventType.BOTTLE_FEED && (
        <BottleIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.NURSING && (
        <NursingIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.PUMPING && (
        <BreastPumpIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.DIAPER_CHANGE &&
        ((data as SerializeFrom<DiaperChangeEvent>).poop ? (
          <PoopIcon className="h-full w-5 flex items-center text-base" />
        ) : (
          <PeeIcon className="h-full w-5 flex items-center text-base" />
        ))}
      {data?.TYPE === BabyCareEventType.SLEEP && (
        <SleepIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.PLAY && (
        <ChildToyIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.BATH && (
        <BathIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data && (
        <div className="flex items-center justify-center rounded uppercase ml-1 text-3xs font-medium leading-4 bg-slate-500 px-1 text-slate-100">
          {data.TYPE === BabyCareEventType.DIAPER_CHANGE
            ? (data as SerializeFrom<DiaperChangeEvent>).poop
              ? BabyCareEventType.__POOP
              : BabyCareEventType.__PEE
            : data.TYPE}
        </div>
      )}
    </div>
  );
};

export const BabyCareEventGrid = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  events: SerializeFrom<BabyCareEvent>[];
}) => {
  const { profile, events } = props;
  const [params] = useSearchParams();
  const submit = useSubmit();
  const [eventToEdit, setEventToEdit] = useState<
    SerializeFrom<BabyCareEvent> | undefined
  >(undefined);
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(
    undefined
  );
  const [selectedDate, _setSelectedDate] = useState<Date>(
    startOfDay(
      params.has("date") ? parseISO(params.get("date") as string) : new Date()
    )
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
    <div className="w-screen h-half-screen home__event-grid sticky">
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
                    input:
                      "py-0 px-2 w-16 h-7 text-slate-600 cursor-pointer text-sm",
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
            <div className="rounded  text-slate-100 bg-slate-500 text-2xs font-semibold px-1 h-4 flex items-center justify-center ml-1">
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
                event.TYPE === BabyCareEventType.DIAPER_CHANGE
                  ? (event as SerializeFrom<DiaperChangeEvent>).poop
                    ? BabyCareEventType.__POOP
                    : BabyCareEventType.__PEE
                  : event.TYPE
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
              <div className="rounded  text-slate-100 bg-slate-500 text-2xs font-semibold px-1 h-4 flex items-center justify-center ml-1">
                {items.length ?? 0}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="ag-theme-quartz h-full">
        <AgGridReact
          headerHeight={0}
          gridOptions={{
            getRowId: (data) => data.data.HASH,
            suppressCellFocus: true,
            onRowDoubleClicked: (event) => {
              setEventToEdit(event.data);
            },
            rowStyle: { cursor: "pointer" },
          }}
          columnDefs={[
            {
              headerName: "Time",
              field: "time",
              resizable: false,
              width: 50,
              cellStyle: { textAlign: "center", fontSize: "12px" },
              suppressSizeToFit: true,
              cellClass: "text-slate-600 pr-0",
              valueFormatter: (params) =>
                format(new Date(params.value), "HH:mm"),
            },
            {
              headerName: "Type",
              field: "time",
              sortable: false,
              resizable: false,
              width: 75,
              cellClass: "px-0",
              suppressSizeToFit: true,
              cellRenderer: EventTypeRenderer,
            },
            {
              headerName: "Overview",
              field: "time",
              sortable: false,
              resizable: false,
              flex: 1,
              cellClass: "pr-0 pl-1",
              cellRendererParams: {
                profile,
                setEventToEdit,
              },
              cellRenderer: EventOverviewRenderer,
            },
          ]}
          rowData={events.filter((event) => {
            switch (selectedEvent) {
              case undefined:
                return true;
              case BabyCareEventType.__POOP:
                return (
                  event.TYPE === BabyCareEventType.DIAPER_CHANGE &&
                  (event as SerializeFrom<DiaperChangeEvent>).poop
                );
              case BabyCareEventType.__PEE:
                return (
                  event.TYPE === BabyCareEventType.DIAPER_CHANGE &&
                  !(event as SerializeFrom<DiaperChangeEvent>).poop
                );
              default:
                return event.TYPE === selectedEvent;
            }
          })}
          modules={[ClientSideRowModelModule]}
        />
        {eventToEdit && (
          <BabyCareEventEditor
            open={Boolean(eventToEdit)}
            onClose={() => setEventToEdit(undefined)}
            data={eventToEdit}
          />
        )}
      </div>
    </div>
  );
};
