import { AgGridReact } from "@ag-grid-community/react";
import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
  DiaperChangeEvent,
} from "../../data/baby-care";
import { ClientSideRowModelModule } from "@ag-grid-community/client-side-row-model";
import { format } from "date-fns";
import {
  BabyCareEmoji,
  BathIcon,
  BottleIcon,
  BreastPumpIcon,
  ChildToyIcon,
  NursingIcon,
  PeeIcon,
  PoopIcon,
  SleepIcon,
} from "../../shared/Icons";
import type { ICellRendererParams } from "@ag-grid-community/core";

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
              ? "Poop"
              : "Pee"
            : data.type}
        </div>
      )}
    </div>
  );
};

export const BabyCareEventViewer = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  events: SerializeFrom<BabyCareEvent>[];
}) => {
  const { profile, events } = props;

  return (
    <div className="ag-theme-quartz w-screen">
      <AgGridReact
        // columnAu
        columnDefs={[
          {
            field: "time",
            headerName: "⏰",
            sortable: true,
            resizable: false,
            width: 65,
            cellStyle: { textAlign: "center" },
            headerClass: "ag-customized-icon-header",
            suppressSizeToFit: true,
            valueFormatter: (params) => format(new Date(params.value), "HH:mm"),
          },
          {
            headerName: "",
            sortable: false,
            resizable: false,
            width: 100,
            suppressSizeToFit: true,
            cellRenderer: EventTypeRenderer,
          },
          {
            headerName: "",
            sortable: false,
            resizable: false,
            flex: 1,
            cellRenderer: EventTypeRenderer,
          },
        ]}
        domLayout="autoHeight"
        rowData={events}
        modules={[ClientSideRowModelModule]}
      ></AgGridReact>
    </div>
  );
};
