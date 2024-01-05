import { AgGridReact } from "@ag-grid-community/react";
import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareAction,
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
  type BottleFeedEvent,
  type DiaperChangeEvent,
  type NursingEvent,
  type PumpingEvent,
  type MeasurementEvent,
  type MedicineEvent,
} from "../../data/BabyCare";
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
  MeasurementIcon,
  MedicineIcon,
  MoreVertIcon,
  NoteIcon,
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
import { BabyCareEventEditor } from "./BabyCareEventEditor";
import { isNonNullable } from "../../shared/AssertionUtils";
import { pruneFormData } from "../../shared/FormDataUtils";
import { Divider } from "@mui/material";
import { mlToOz } from "../../shared/UnitUtils";

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
    const newValue = Math.max(_min, Math.min(_max, value)) * (factor ?? 1);
    // NOTE: trick to avoid floating point error in JS
    // See https://stackoverflow.com/questions/50778431/why-does-0-1-0-2-return-unpredictable-float-results-in-javascript-while-0-2
    // See https://stackoverflow.com/questions/11832914/how-to-round-to-at-most-2-decimal-places-if-necessary
    setValue((step ?? 1) % 1 !== 0 ? Math.round(newValue * 10) / 10 : newValue);
  };

  return (
    <div
      className={cn(
        "h-6 w-24 shrink-0 flex justify-center items-center text-slate-600 bg-slate-100 rounded relative",
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

const EventOverview = (props: { data: SerializeFrom<BabyCareEvent> }) => {
  const { data } = props;

  const [volume, setVolume] = useState(
    (data as SerializeFrom<BottleFeedEvent | PumpingEvent>).volume
  );
  const [leftDuration, setLeftDuration] = useState(
    (data as SerializeFrom<NursingEvent>).leftDuration
  );
  const [rightDuration, setRightDuration] = useState(
    (data as SerializeFrom<NursingEvent>).rightDuration
  );
  const [height, setHeight] = useState(
    (data as SerializeFrom<MeasurementEvent>).height
  );
  const [weight, setWeight] = useState(
    (data as SerializeFrom<MeasurementEvent>).weight
  );

  const submit = useSubmit();
  const debouncedUpdate = useMemo(
    () =>
      debounce(
        (formData: {
          volume?: number | undefined;
          leftDuration?: number | undefined;
          rightDuration?: number | undefined;
          height?: number | undefined;
          weight?: number | undefined;
        }) => {
          let action: string;
          switch (data.TYPE) {
            case BabyCareEventType.BOTTLE_FEED: {
              action = BabyCareAction.UPDATE_BOTTLE_FEED_EVENT;
              break;
            }
            case BabyCareEventType.PUMPING: {
              action = BabyCareAction.UPDATE_PUMPING_EVENT;
              break;
            }
            case BabyCareEventType.NURSING: {
              action = BabyCareAction.UPDATE_NURSING_EVENT;
              break;
            }
            case BabyCareEventType.MEASUREMENT: {
              action = BabyCareAction.UPDATE_MEASUREMENT_EVENT;
              break;
            }
            default:
              return;
          }
          submit(
            pruneFormData({
              __action: action,
              ...data,
              volume: formData?.volume,
              leftDuration: formData?.leftDuration,
              rightDuration: formData?.rightDuration,
              height: formData?.height,
              weight: formData?.weight,
            }),
            { method: HttpMethod.POST }
          );
        },
        200
      ),
    [submit, data]
  );

  return (
    <>
      {(data.TYPE === BabyCareEventType.BOTTLE_FEED ||
        data.TYPE === BabyCareEventType.PUMPING) && (
        <InlineNumberInput
          min={0}
          max={1000}
          step={5}
          unit={"ml"}
          value={volume}
          setValue={(value) => {
            debouncedUpdate.cancel();
            setVolume(value);
            debouncedUpdate({ volume: value });
          }}
          className="mr-2"
        />
      )}
      {data.TYPE === BabyCareEventType.BOTTLE_FEED &&
        (data as SerializeFrom<BottleFeedEvent>).formulaMilkVolume && (
          <div className="h-6 w-24 shrink-0 flex justify-center items-center text-slate-600 bg-slate-100 rounded relative">
            <div className="w-full h-full flex rounded justify-center items-center">
              <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
                F
              </div>
              <div className="flex items-center font-mono text-xs">
                {(data as SerializeFrom<BottleFeedEvent>).formulaMilkVolume}
              </div>
              <div className="flex items-center font-mono text-2xs ml-0.5">
                ml
              </div>
            </div>
          </div>
        )}
      {data.TYPE === BabyCareEventType.NURSING && (
        <>
          <InlineNumberInput
            value={leftDuration}
            unit={"mn"}
            factor={60 * 1000}
            step={1}
            setValue={(value) => {
              debouncedUpdate.cancel();
              setLeftDuration(value);
              debouncedUpdate({ leftDuration: value, rightDuration });
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
              debouncedUpdate({ leftDuration, rightDuration: value });
            }}
            className="mr-2"
          >
            <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
              R
            </div>
          </InlineNumberInput>
        </>
      )}
      {data.TYPE === BabyCareEventType.MEASUREMENT && (
        <>
          <InlineNumberInput
            min={0}
            max={300}
            step={1}
            unit="cm"
            value={height ?? 0}
            setValue={(value) => {
              debouncedUpdate.cancel();
              setHeight(value);
              debouncedUpdate({ height: value, weight });
            }}
            className="mr-2"
          >
            <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
              H
            </div>
          </InlineNumberInput>
          <InlineNumberInput
            min={0}
            max={100}
            step={0.1}
            unit="kg"
            value={weight ?? 0}
            setValue={(value) => {
              debouncedUpdate.cancel();
              setWeight(value);
              debouncedUpdate({ weight: value, height });
            }}
            className="mr-2"
          >
            <div className="flex items-center justify-center h-3 w-3 rounded-full text-4xs bg-slate-500 text-slate-100 font-bold mr-1">
              W
            </div>
          </InlineNumberInput>
        </>
      )}
      {data.TYPE === BabyCareEventType.MEDICINE &&
        (data as SerializeFrom<MedicineEvent>).prescription && (
          <div className="flex items-center rounded h-6 text-2xs text-slate-600 bg-indigo-100 px-2">
            {(data as SerializeFrom<MedicineEvent>).prescription}
          </div>
        )}
    </>
  );
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
      {data?.TYPE === BabyCareEventType.MEASUREMENT && (
        <MeasurementIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.MEDICINE && (
        <MedicineIcon className="h-full w-5 flex items-center text-base" />
      )}
      {data?.TYPE === BabyCareEventType.NOTE && (
        <NoteIcon className="h-full w-5 flex items-center text-base" />
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

const BabyCareEventGridSummary = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  events: SerializeFrom<BabyCareEvent>[];
}) => {
  const { events } = props;
  const indexedData = Object.entries(
    merge(
      {
        [BabyCareEventType.BOTTLE_FEED]: [],
        [BabyCareEventType.PUMPING]: [],
        [BabyCareEventType.__POOP]: [],
        [BabyCareEventType.__PEE]: [],
        [BabyCareEventType.SLEEP]: [],
        [BabyCareEventType.BATH]: [],
        [BabyCareEventType.PLAY]: [],
        [BabyCareEventType.NURSING]: [],
      },
      groupBy(events, (event) =>
        event.TYPE === BabyCareEventType.DIAPER_CHANGE
          ? (event as SerializeFrom<DiaperChangeEvent>).poop
            ? BabyCareEventType.__POOP
            : BabyCareEventType.__PEE
          : event.TYPE
      )
    )
  );
  // stats
  const poopEventCount =
    indexedData.find(([type]) => type === BabyCareEventType.__POOP)?.[1]
      .length ?? 0;
  const bottleEvents = (indexedData.find(
    ([type]) => type === BabyCareEventType.BOTTLE_FEED
  )?.[1] ?? []) as SerializeFrom<BottleFeedEvent>[];
  const totalBottleFeedVolume = bottleEvents.reduce(
    (acc, data) => acc + data.volume,
    0
  );
  const pumpingEvents = (indexedData.find(
    ([type]) => type === BabyCareEventType.PUMPING
  )?.[1] ?? []) as SerializeFrom<PumpingEvent>[];
  const totalPumpingVolume = pumpingEvents.reduce(
    (acc, data) => acc + data.volume,
    0
  );

  // TODO?: customize this view by stage (newborn, infant, toddler, etc.)
  return (
    <div className="flex items-center w-full bg-slate-700 overflow-y-hidden overflow-x-auto select-none">
      <div className="h-10 flex items-center px-3">
        <div className="text-slate-300 font-semibold text-xs">SUMMARY</div>
        <div className="flex ml-1.5">
          <div className="flex items-center rounded bg-slate-300 text-slate-700 px-2 py-1 text-xs ml-1.5 mono font-medium">
            <BottleIcon className="text-[15px] leading-[15px] w-[23px]" />
            <div className="ml-0.5">{totalBottleFeedVolume}ml</div>
            <Divider
              className="h-full bg-slate-400 mx-1"
              orientation="vertical"
            />
            <div className="ml-0.5">
              {Math.round(mlToOz(totalBottleFeedVolume))}oz
            </div>
            <Divider
              className="h-full bg-slate-400 mx-1"
              orientation="vertical"
            />
            <div className="">{bottleEvents.length}</div>
          </div>
          <div className="flex items-center rounded bg-slate-300 text-slate-700 px-2 py-1 text-xs ml-1.5 mono font-medium">
            <BreastPumpIcon className="text-[15px] leading-[15px] w-[23px]" />
            <div className="ml-0.5">{totalPumpingVolume}ml</div>
            <Divider
              className="h-full bg-slate-400 mx-1"
              orientation="vertical"
            />
            <div className="ml-0.5">
              {Math.round(mlToOz(totalPumpingVolume))}
              oz
            </div>
            <Divider
              className="h-full bg-slate-400 mx-1"
              orientation="vertical"
            />
            <div className="">{pumpingEvents.length}</div>
          </div>
          <div className="flex items-center rounded bg-slate-300 text-slate-700 px-2 py-1 text-xs ml-1.5 mono font-medium">
            <PoopIcon className="text-[15px] leading-[15px] w-[23px]" />
            <div className="ml-0.5">{poopEventCount}</div>
          </div>
        </div>
      </div>
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
    <div className="w-full h-full home__event-grid">
      <div className="flex items-center w-full bg-slate-100 overflow-y-hidden overflow-x-auto">
        <div className="h-10 flex items-center px-2">
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
                      "py-0 px-2 w-24 h-7 text-slate-600 cursor-pointer text-sm",
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
            format="MMM dd, EEE"
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
                [BabyCareEventType.BOTTLE_FEED]: [],
                [BabyCareEventType.PUMPING]: [],
                [BabyCareEventType.__POOP]: [],
                [BabyCareEventType.__PEE]: [],
                [BabyCareEventType.SLEEP]: [],
                [BabyCareEventType.BATH]: [],
                [BabyCareEventType.PLAY]: [],
                [BabyCareEventType.NURSING]: [],
                [BabyCareEventType.MEASUREMENT]: [],
                [BabyCareEventType.MEDICINE]: [],
                [BabyCareEventType.NOTE]: [],
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
                  <BottleIcon className="text-[22px] leading-[22px]" />
                )}
                {type === BabyCareEventType.NURSING && (
                  <NursingIcon className="text-[22px] leading-[22px]" />
                )}
                {type === BabyCareEventType.PUMPING && (
                  <BreastPumpIcon className="text-[22px] leading-[22px]" />
                )}
                {type === BabyCareEventType.__PEE && (
                  <PeeIcon className="text-[22px] leading-[22px]" />
                )}
                {type === BabyCareEventType.__POOP && (
                  <PoopIcon className="text-[22px] leading-[22px]" />
                )}
                {type === BabyCareEventType.SLEEP && (
                  <SleepIcon className="text-[22px] leading-[22px]" />
                )}
                {type === BabyCareEventType.PLAY && (
                  <ChildToyIcon className="text-[22px] leading-[22px]" />
                )}
                {type === BabyCareEventType.BATH && (
                  <BathIcon className="text-[22px] leading-[22px]" />
                )}
                {type === BabyCareEventType.MEASUREMENT && (
                  <MeasurementIcon className="text-[22px] leading-[22px]" />
                )}
                {type === BabyCareEventType.MEDICINE && (
                  <MedicineIcon className="text-[22px] leading-[22px]" />
                )}
                {type === BabyCareEventType.NOTE && (
                  <NoteIcon className="text-[22px] leading-[22px]" />
                )}
              </div>
              <div className="rounded  text-slate-100 bg-slate-500 text-2xs font-semibold px-1 h-4 flex items-center justify-center ml-1">
                {items.length ?? 0}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="ag-theme-quartz h-[calc(100%_-_80px)]">
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
      <BabyCareEventGridSummary profile={profile} events={events} />
    </div>
  );
};
