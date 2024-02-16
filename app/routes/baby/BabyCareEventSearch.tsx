import type { SerializeFrom } from "@remix-run/node";
import {
  BabyCareEventType,
  type BabyCareEvent,
  type BabyCareProfile,
} from "../../data/BabyCare";
import { format, isEqual, parseISO, startOfDay } from "date-fns";
import { MobileDatePicker } from "@mui/x-date-pickers";
import { useSearchParams } from "@remix-run/react";
import { BabyCareEventGrid } from "./BabyCareEventGrid";
import {
  Divider,
  MenuItem,
  Select,
  TablePagination,
  type SelectChangeEvent,
  TextField,
} from "@mui/material";
import {
  debounce,
  parseNumber,
  pruneNullValues,
  returnUndefOnError,
} from "../../shared/CommonUtils";
import {
  DEFAULT_SEARCH_PAGE_SIZE,
  MINIMUM_AUTOCOMPLETE_SEARCH_TEXT_LENGTH,
} from "../../data/constants";
import { cn } from "../../shared/StyleUtils";
import { ChildCareIcon } from "../../shared/Icons";
import { useMemo, useState } from "react";
import { Search } from "@mui/icons-material";

export const BabyCareEventSearch = (props: {
  profile: SerializeFrom<BabyCareProfile>;
  events: SerializeFrom<BabyCareEvent>[];
  totalCount: number;
}) => {
  const { profile, events, totalCount } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const eventType = searchParams.get("type");

  // date
  const birthDate = new Date(profile.dob);
  const startDate = searchParams.has("startDate")
    ? startOfDay(parseISO(searchParams.get("startDate") as string))
    : null;
  const setStartDate = (date: Date | null) => {
    if (!date) {
      setSearchParams((params) => {
        params.delete("startDate");
        return params;
      });
    }
    if (date && !isEqual(date, startOfDay(new Date()))) {
      setSearchParams((params) => {
        params.set("startDate", format(date, "yyyy-MM-dd"));
        return params;
      });
    }
  };
  const endDate = searchParams.has("endDate")
    ? startOfDay(parseISO(searchParams.get("endDate") as string))
    : null;
  const setEndDate = (date: Date | null) => {
    if (!date) {
      setSearchParams((params) => {
        params.delete("endDate");
        return params;
      });
    }
    if (date && !isEqual(date, startOfDay(new Date()))) {
      setSearchParams((params) => {
        params.set("endDate", format(date, "yyyy-MM-dd"));
        return params;
      });
    }
  };

  // search term
  const [searchTerm, setSearchTerm] = useState(
    decodeURIComponent(searchParams.get("text") ?? "")
  );
  const debouncedSearch = useMemo(
    () =>
      debounce((input: string): void => {
        setSearchParams((params) => {
          if (
            input &&
            input.length >= MINIMUM_AUTOCOMPLETE_SEARCH_TEXT_LENGTH
          ) {
            params.set("text", encodeURIComponent(input));
          } else {
            params.delete("text");
          }
          return params;
        });
      }, 500),
    [setSearchParams]
  );

  // pagination
  const page =
    returnUndefOnError(() => parseNumber(searchParams.get("page") ?? "NaN")) ??
    1;

  return (
    <div className="w-full h-full">
      <div className="h-10 flex items-center w-full bg-slate-100 overflow-y-hidden overflow-x-auto pl-2">
        <Select
          value={eventType ?? "None"}
          onChange={(event: SelectChangeEvent) => {
            setSearchParams((params) => {
              const eventType =
                event.target.value === "None"
                  ? undefined
                  : event.target.value.toLowerCase();
              if (eventType) {
                params.set("type", eventType);
              }
              return params;
            });
          }}
          classes={{
            select: "pt-0 pb-0 w-30 h-7 flex items-center text-sm",
          }}
        >
          <MenuItem value={"None"}>
            <div className="text-zinc-400">None</div>
          </MenuItem>
          <Divider />
          <MenuItem value={BabyCareEventType.MEASUREMENT.toLowerCase()}>
            Measurement
          </MenuItem>
          <MenuItem value={BabyCareEventType.MEDICINE.toLowerCase()}>
            Medicine
          </MenuItem>
          <MenuItem value={BabyCareEventType.__MEMORY.toLowerCase()}>
            Memory
          </MenuItem>
          <MenuItem value={BabyCareEventType.NOTE.toLowerCase()}>Note</MenuItem>
          <Divider />
          <MenuItem value={BabyCareEventType.BOTTLE_FEED.toLowerCase()}>
            Bottle Feeding
          </MenuItem>
          <MenuItem value={BabyCareEventType.PUMPING.toLowerCase()}>
            Pumping
          </MenuItem>
          <MenuItem value={BabyCareEventType.NURSING.toLowerCase()}>
            Nursing
          </MenuItem>
          <Divider />
          <MenuItem value={BabyCareEventType.__POOP.toLowerCase()}>
            Poop
          </MenuItem>
          <MenuItem value={BabyCareEventType.__PEE.toLowerCase()}>Pee</MenuItem>
          <Divider />
          <MenuItem value={BabyCareEventType.PLAY.toLowerCase()}>Play</MenuItem>
          <MenuItem value={BabyCareEventType.BATH.toLowerCase()}>Bath</MenuItem>
          <MenuItem value={BabyCareEventType.SLEEP.toLowerCase()}>
            Sleep
          </MenuItem>
        </Select>
        <Divider className="h-5 mx-2 " orientation="vertical" />
        <div className="flex items-center">
          <MobileDatePicker
            slotProps={{
              textField: {
                placeholder: "From",
                InputProps: {
                  classes: {
                    input:
                      "py-0 px-2 w-24 h-7 text-slate-600 cursor-pointer text-sm",
                    notchedOutline:
                      "border-2 border-slate-200 hover:border-slate-300",
                  },
                },
              },
              actionBar: {
                actions: ["cancel", "clear", "accept"],
              },
            }}
            {...pruneNullValues({ maxDate: endDate })}
            value={startDate}
            onAccept={(value: Date | null) => {
              setStartDate(value ? startOfDay(value) : null);
            }}
            format="MMM dd, EEE"
          />
          <button
            className={cn(
              "h-7 flex items-center px-0.5 rounded border-2 border-slate-200 hover:border-slate-300 ml-1",
              {
                "bg-blue-100 border-blue-500 hover:border-blue-500":
                  startDate && isEqual(startDate, startOfDay(birthDate)),
              }
            )}
            onClick={() => setStartDate(birthDate)}
          >
            <ChildCareIcon className="text-slate-600" />
          </button>
          <div className="h-full flex items-center text-xl mx-2 text-slate-300 select-none">
            -
          </div>
          <MobileDatePicker
            slotProps={{
              textField: {
                placeholder: "To",
                InputProps: {
                  classes: {
                    input:
                      "py-0 px-2 w-24 h-7 text-slate-600 cursor-pointer text-sm",
                    notchedOutline:
                      "border-2 border-slate-200 hover:border-slate-300",
                  },
                },
              },
              actionBar: {
                actions: ["cancel", "clear", "accept"],
              },
            }}
            {...pruneNullValues({ minDate: startDate })}
            value={endDate}
            onAccept={(value: Date | null) => {
              setEndDate(value ? startOfDay(value) : null);
            }}
            format="MMM dd, EEE"
          />
        </div>
        <Divider className="h-5 mx-2 " orientation="vertical" />
        <TextField
          inputProps={{
            className: "px-2 text-sm",
          }}
          InputProps={{
            classes: {
              root: "w-40 h-7 flex items-center py-0 px-1",
            },
            endAdornment: (
              <>
                <Search className="text-slate-400" />
              </>
            ),
          }}
          placeholder="Search..."
          value={searchTerm}
          onChange={(event) => {
            const value = event.target.value;
            debouncedSearch?.cancel();
            setSearchTerm(value);
            debouncedSearch?.(value);
          }}
        />
      </div>
      {!eventType && (
        <div className="h-[calc(100%_-_40px)] flex justify-center items-center font-medium text-slate-500 select-none text-sm">
          Select an event type to start
        </div>
      )}
      {eventType && (
        <>
          <div className="ag-theme-quartz h-[calc(100%_-_80px)]">
            <BabyCareEventGrid
              events={events}
              profile={profile}
              showDate
              readOnly
            />
          </div>
          <div className="h-10 w-full flex items-center justify-end bg-slate-700 overflow-y-hidden overflow-x-auto select-none">
            <TablePagination
              component="div"
              classes={{
                actions: "ml-4",
                toolbar: "pl-4",
                displayedRows: "text-slate-300 font-mono text-xs italic",
              }}
              count={totalCount}
              // NOTE: page in this component is 0-based while the searchParams's is 1-based
              page={page - 1}
              onPageChange={(event, page) => {
                setSearchParams((params) => {
                  if (page === 0) {
                    params.delete("page");
                    return params;
                  }
                  params.set("page", (page + 1).toString());
                  return params;
                });
              }}
              labelDisplayedRows={({ from, to, count }) =>
                `Showing ${from}-${to} of ${count} records`
              }
              showFirstButton
              showLastButton
              slotProps={{
                actions: {
                  firstButton: {
                    classes: {
                      root: "text-slate-300",
                      disabled: "text-slate-500",
                    },
                  },
                  previousButton: {
                    classes: {
                      root: "text-slate-300",
                      disabled: "text-slate-500",
                    },
                  },
                  nextButton: {
                    classes: {
                      root: "text-slate-300",
                      disabled: "text-slate-500",
                    },
                  },
                  lastButton: {
                    classes: {
                      root: "text-slate-300",
                      disabled: "text-slate-500",
                    },
                  },
                },
              }}
              rowsPerPageOptions={[]} // hide rows per page
              rowsPerPage={DEFAULT_SEARCH_PAGE_SIZE}
            />
          </div>
        </>
      )}
    </div>
  );
};
