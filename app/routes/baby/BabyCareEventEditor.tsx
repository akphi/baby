import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Select,
  Switch,
  TextField,
  createFilterOptions,
  type SelectChangeEvent,
  MenuItem,
  FormHelperText,
  Link,
} from "@mui/material";
import {
  BabyCareAction,
  BabyCareEventType,
  type BabyCareEvent,
  type BottleFeedEvent,
  type PumpingEvent,
  type NursingEvent,
  type DiaperChangeEvent,
  type PlayEvent,
  type SleepEvent,
  type MeasurementEvent,
  type MedicineEvent,
  type BabyCareProfile,
  type NoteEvent,
  NotePurpose,
  type TravelEvent,
} from "../../data/BabyCare";
import { useFetcher, useSubmit } from "@remix-run/react";
import { useMemo, useState } from "react";
import { NumberInput, OptionalNumberInput } from "../../shared/NumberInput";
import { DesktopDateTimePicker } from "@mui/x-date-pickers";
import type { SerializeFrom } from "@remix-run/node";
import { add, isAfter, parseISO } from "date-fns";
import { HttpMethod } from "../../shared/NetworkUtils";
import { ConfirmationDialog } from "../../shared/ConfirmationDialog";
import { pruneFormData } from "../../shared/FormDataUtils";
import { isString } from "../../shared/AssertionUtils";
import { debounce } from "lodash-es";
import { Forward10, Replay30 } from "@mui/icons-material";
import { BabyCareEmoji, MyLocationIcon } from "../../shared/Icons";

interface PrescriptionOption {
  inputValue?: string;
  prescription: string;
}

// NOTE: we made this overly complex as it's an all-in-one editor for all types of events since we don't
// want to duplicate code, we might want to revisit this in the future and think of a better way to reuse code here
export const BabyCareEventEditor = (props: {
  open: boolean;
  onClose: () => void;
  data: SerializeFrom<BabyCareEvent>;
  profile: SerializeFrom<BabyCareProfile>;
  readOnly?: boolean | undefined;
}) => {
  const { open, onClose, data, profile, readOnly } = props;
  const [showDeleteConfirmationDialog, setShowDeleteConfirmationDialog] =
    useState(false);
  const submit = useSubmit();
  const fetcher = useFetcher<{
    prescriptions: string[];
  }>();
  const prescriptionSuggestions: PrescriptionOption[] = (
    fetcher.data?.prescriptions ?? []
  ).map((prescription) => ({
    prescription,
  }));
  const [prescriptionOption, setPrescriptionOption] =
    useState<PrescriptionOption | null>(
      (data as SerializeFrom<MedicineEvent>).prescription
        ? { prescription: (data as SerializeFrom<MedicineEvent>).prescription }
        : null
    );
  const isLoadingPrescriptionSuggestions = fetcher.state === "loading";

  const debouncedFetchPrescriptionSuggestions = useMemo(
    () =>
      debounce((input: string): void => {
        fetcher.load(
          `/api/runCommand/${BabyCareAction.FETCH_TOP_PRESCRIPTIONS}?profileId=${profile.id}&searchText=${input}`
        );
      }, 500),
    [profile, fetcher]
  );

  const [time, setTime] = useState(parseISO(data.time));
  const [comment, setComment] = useState(data.comment ?? undefined);

  const [duration, setDuration] = useState(
    (
      data as SerializeFrom<
        BottleFeedEvent | PumpingEvent | PlayEvent | SleepEvent
      >
    ).duration ?? undefined
  );
  const [volume, setVolume] = useState(
    (data as SerializeFrom<BottleFeedEvent | PumpingEvent>).volume
  );
  const [formulaMilkVolume, setFormulaMilkVolume] = useState(
    (data as SerializeFrom<BottleFeedEvent>).formulaMilkVolume
  );
  const [leftDuration, setLeftDuration] = useState(
    (data as SerializeFrom<NursingEvent>).leftDuration
  );
  const [rightDuration, setRightDuration] = useState(
    (data as SerializeFrom<NursingEvent>).rightDuration
  );
  const [pee, setPee] = useState(
    (data as SerializeFrom<DiaperChangeEvent>).pee
  );
  const [poop, setPoop] = useState(
    (data as SerializeFrom<DiaperChangeEvent>).poop
  );
  const [height, setHeight] = useState(
    (data as SerializeFrom<MeasurementEvent>).height
  );
  const [weight, setWeight] = useState(
    (data as SerializeFrom<MeasurementEvent>).weight
  );
  const [purpose, setPurpose] = useState(
    (data as SerializeFrom<NoteEvent>).purpose
  );
  const [destination, setDestination] = useState(
    (data as SerializeFrom<TravelEvent>).destination
  );
  const [endTime, setEndTime] = useState(
    (data as SerializeFrom<TravelEvent>).endTime
      ? parseISO((data as SerializeFrom<TravelEvent>).endTime)
      : parseISO(data.time) // set minimum to the same as time
  );
  const [timeZone, setTimeZone] = useState(
    (data as SerializeFrom<TravelEvent>).timeZone
  );

  const onSubmit = () => {
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
      case BabyCareEventType.DIAPER_CHANGE: {
        action = BabyCareAction.UPDATE_DIAPER_CHANGE_EVENT;
        break;
      }
      case BabyCareEventType.PLAY: {
        action = BabyCareAction.UPDATE_PLAY_EVENT;
        break;
      }
      case BabyCareEventType.BATH: {
        action = BabyCareAction.UPDATE_BATH_EVENT;
        break;
      }
      case BabyCareEventType.SLEEP: {
        action = BabyCareAction.UPDATE_SLEEP_EVENT;
        break;
      }
      case BabyCareEventType.MEASUREMENT: {
        action = BabyCareAction.UPDATE_MEASUREMENT_EVENT;
        break;
      }
      case BabyCareEventType.MEDICINE: {
        action = BabyCareAction.UPDATE_MEDICINE_EVENT;
        break;
      }
      case BabyCareEventType.NOTE: {
        action = BabyCareAction.UPDATE_NOTE_EVENT;
        break;
      }
      case BabyCareEventType.TRAVEL: {
        action = BabyCareAction.UPDATE_TRAVEL_EVENT;
        break;
      }
      default:
        return;
    }
    submit(
      pruneFormData({
        __action: action,
        ...data,
        time: time.toISOString(),
        comment,

        // attributes from specific events
        duration,
        volume,

        formulaMilkVolume,
        leftDuration,
        rightDuration,

        pee,
        poop,

        height,
        weight,

        prescription: prescriptionOption?.prescription,
        purpose,

        endTime: endTime?.toISOString(),
        destination,
        timeZone,
      }),
      {
        method: HttpMethod.POST,
        // NOTE: force using fetcher so we can potentially intercept and capture pending items
        // to render optimistic UI.
        //
        // Interestingly, if we just use `useFetcher` and `fetcher.submit`, for some reason, closing
        // the dialog immediately causes the fetcher call to be cancelled, but that's not the case for `useSubmit`
        navigate: false,
        fetcherKey: BabyCareAction.EDIT_GENERIC_EVENT,
      }
    );

    onClose();
  };

  const eventTypeIcon =
    data.TYPE === BabyCareEventType.BOTTLE_FEED
      ? BabyCareEmoji.BOTTLE
      : data.TYPE === BabyCareEventType.NURSING
      ? BabyCareEmoji.NURSING
      : data.TYPE === BabyCareEventType.PUMPING
      ? BabyCareEmoji.BREAST_PUMP
      : data.TYPE === BabyCareEventType.DIAPER_CHANGE
      ? (data as SerializeFrom<DiaperChangeEvent>).poop
        ? BabyCareEmoji.POOP
        : BabyCareEmoji.PEE
      : data.TYPE === BabyCareEventType.PLAY
      ? BabyCareEmoji.CHILD_TOY
      : data.TYPE === BabyCareEventType.BATH
      ? BabyCareEmoji.BATH
      : data.TYPE === BabyCareEventType.SLEEP
      ? BabyCareEmoji.SLEEP
      : data.TYPE === BabyCareEventType.MEASUREMENT
      ? BabyCareEmoji.MEASUREMENT
      : data.TYPE === BabyCareEventType.MEDICINE
      ? BabyCareEmoji.MEDICINE
      : data.TYPE === BabyCareEventType.NOTE
      ? BabyCareEmoji.NOTE
      : data.TYPE === BabyCareEventType.TRAVEL
      ? BabyCareEmoji.TRAVEL
      : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      // NOTE: workaround to make autofocus work properly with dialog
      // See https://github.com/mui/material-ui/issues/33004#issuecomment-1473299089
      disableRestoreFocus={true}
      hideBackdrop={true}
    >
      <DialogTitle>{`${readOnly ? "View" : "Update"}${
        eventTypeIcon ? ` ${eventTypeIcon}` : ""
      } Event`}</DialogTitle>
      <DialogContent dividers>
        <form
          onSubmit={onSubmit}
          method={HttpMethod.POST}
          autoComplete="off"
          noValidate
        >
          <div className="w-full py-2 flex">
            <DesktopDateTimePicker
              label="Time"
              value={time}
              onChange={(value: Date | null) => {
                setTime(value ?? new Date());
              }}
              format="MMM dd - HH:mm"
              className="w-full"
              disabled={Boolean(readOnly)}
            />
            {!readOnly && (
              <div className="flex justify-center items-center ml-2">
                <IconButton
                  className="w-10 h-10"
                  onClick={() =>
                    setTime(
                      add(time, {
                        minutes: -30,
                      })
                    )
                  }
                  disabled={Boolean(readOnly)}
                >
                  <Replay30
                    fontSize="large"
                    className="text-slate-300 hover:text-slate-400"
                  />
                </IconButton>
                <IconButton
                  className="w-10 h-10"
                  onClick={() =>
                    setTime(
                      add(time, {
                        minutes: 10,
                      })
                    )
                  }
                  disabled={Boolean(readOnly)}
                >
                  <Forward10
                    fontSize="large"
                    className="text-slate-300 hover:text-slate-400"
                  />
                </IconButton>
              </div>
            )}
          </div>
          {(data.TYPE === BabyCareEventType.BOTTLE_FEED ||
            data.TYPE === BabyCareEventType.PUMPING) && (
            <div className="w-full py-2">
              <NumberInput
                label="Volume"
                min={0}
                max={1000}
                step={5}
                unit="ml"
                value={volume}
                setValue={(value) => {
                  setVolume(value ?? 0);
                }}
                className="flex-1"
                disabled={Boolean(readOnly)}
              />
            </div>
          )}
          {data.TYPE === BabyCareEventType.BOTTLE_FEED && (
            <div className="w-full py-2">
              <OptionalNumberInput
                label="Formula Milk Volume"
                min={0}
                max={1000}
                step={5}
                unit="ml"
                value={formulaMilkVolume}
                setValue={(value) => {
                  setFormulaMilkVolume(value);
                }}
                className="flex-1"
                disabled={Boolean(readOnly)}
              />
            </div>
          )}
          {data.TYPE === BabyCareEventType.NURSING && (
            <>
              <div className="w-full py-2">
                <NumberInput
                  label="Left Duration"
                  min={0}
                  max={60}
                  step={1}
                  unit="min"
                  factor={60 * 1000}
                  value={leftDuration}
                  setValue={(value) => {
                    setLeftDuration(value ?? 0);
                  }}
                  className="flex-1"
                  disabled={Boolean(readOnly)}
                />
              </div>
              <div className="w-full py-2">
                <NumberInput
                  label="Right Duration"
                  min={0}
                  max={60}
                  step={1}
                  unit="min"
                  factor={60 * 1000}
                  value={rightDuration}
                  setValue={(value) => {
                    setRightDuration(value ?? 0);
                  }}
                  className="flex-1"
                  disabled={Boolean(readOnly)}
                />
              </div>
            </>
          )}
          {data.TYPE === BabyCareEventType.DIAPER_CHANGE && (
            <div className="w-full py-2">
              <FormControlLabel
                control={
                  <Switch
                    checked={poop}
                    onChange={(event) => setPoop(event.target.checked)}
                  />
                }
                label="Poop"
                disabled={Boolean(readOnly)}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={pee}
                    onChange={(event) => setPee(event.target.checked)}
                  />
                }
                label="Pee"
                disabled={Boolean(readOnly)}
              />
            </div>
          )}
          {data.TYPE === BabyCareEventType.MEASUREMENT && (
            <>
              <div className="w-full py-2">
                <OptionalNumberInput
                  label="Height"
                  min={0}
                  max={300}
                  step={1}
                  unit="cm"
                  value={height}
                  setValue={(value) => {
                    setHeight(value);
                  }}
                  className="flex-1"
                  disabled={Boolean(readOnly)}
                />
              </div>
              <div className="w-full py-2">
                <OptionalNumberInput
                  label="Weight"
                  min={0}
                  max={100}
                  step={0.1}
                  unit="kg"
                  value={weight}
                  setValue={(value) => {
                    setWeight(value);
                  }}
                  className="flex-1"
                  disabled={Boolean(readOnly)}
                />
              </div>
            </>
          )}
          {data.TYPE === BabyCareEventType.MEDICINE && (
            <div className="w-full py-2">
              <Autocomplete
                value={prescriptionOption}
                getOptionLabel={(option) => {
                  // Value selected with enter, right from the input
                  if (isString(option)) {
                    return option;
                  }
                  return option.prescription;
                }}
                disabled={Boolean(readOnly)}
                onInputChange={(event, newInputValue, reason) => {
                  if (reason === "reset" || reason === "clear") {
                    return;
                  }
                  debouncedFetchPrescriptionSuggestions.cancel();
                  debouncedFetchPrescriptionSuggestions(newInputValue);
                }}
                onChange={(event, newValue) => {
                  if (isString(newValue)) {
                    setPrescriptionOption({
                      prescription: newValue,
                    });
                  } else if (newValue && newValue.inputValue) {
                    // Create a new value from the user input
                    setPrescriptionOption({
                      prescription: newValue.inputValue,
                    });
                  } else {
                    setPrescriptionOption(newValue);
                  }
                }}
                filterOptions={(options, params) => {
                  const filtered = createFilterOptions<PrescriptionOption>()(
                    options,
                    params
                  );

                  const { inputValue } = params;
                  // Suggest the creation of a new value
                  const isExisting = options.some(
                    (option) => inputValue === option.prescription
                  );
                  if (inputValue !== "" && !isExisting) {
                    filtered.push({
                      inputValue,
                      prescription: `Add "${inputValue}"`,
                    });
                  }
                  return filtered;
                }}
                options={prescriptionSuggestions}
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
                loading={isLoadingPrescriptionSuggestions}
                freeSolo
                renderInput={(params: any) => (
                  <TextField
                    {...params}
                    className="w-full"
                    label="Prescription"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {isLoadingPrescriptionSuggestions ? (
                            <CircularProgress color="inherit" size={20} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </div>
          )}
          {data.TYPE === BabyCareEventType.NOTE && (
            <>
              <div className="w-full py-2">
                <FormControl className="w-full">
                  <InputLabel>Purpose</InputLabel>
                  <Select
                    value={purpose ?? "None"}
                    label="Purpose"
                    onChange={(event: SelectChangeEvent) => {
                      setPurpose(
                        event.target.value === "None"
                          ? undefined
                          : event.target.value
                      );
                    }}
                    disabled={Boolean(readOnly)}
                  >
                    <MenuItem value={"None"}>
                      <div className="text-zinc-400">None</div>
                    </MenuItem>
                    <MenuItem value={NotePurpose.MEMORY}>Memory</MenuItem>
                    <MenuItem
                      value={NotePurpose.FOOD_FIRST_TRY}
                    >{`Food (First Try)`}</MenuItem>
                  </Select>
                </FormControl>
              </div>
            </>
          )}
          {data.TYPE === BabyCareEventType.TRAVEL && (
            <>
              <div className="w-full py-2 flex">
                <DesktopDateTimePicker
                  label="End Time"
                  value={endTime}
                  onChange={(value: Date | null) => {
                    setEndTime(value ?? new Date());
                  }}
                  format="MMM dd - HH:mm"
                  className="w-full"
                  disabled={Boolean(readOnly)}
                  minDateTime={time}
                />
                {!readOnly && (
                  <div className="flex justify-center items-center ml-2">
                    <IconButton
                      className="w-10 h-10"
                      onClick={() => {
                        const newValue = add(endTime, {
                          minutes: -30,
                        });
                        if (isAfter(newValue, time)) {
                          setEndTime(newValue);
                        }
                      }}
                      disabled={Boolean(readOnly)}
                    >
                      <Replay30
                        fontSize="large"
                        className="text-slate-300 hover:text-slate-400"
                      />
                    </IconButton>
                    <IconButton
                      className="w-10 h-10"
                      onClick={() => {
                        const newValue = add(endTime, {
                          minutes: 10,
                        });
                        if (isAfter(newValue, time)) {
                          setEndTime(newValue);
                        }
                      }}
                      disabled={Boolean(readOnly)}
                    >
                      <Forward10
                        fontSize="large"
                        className="text-slate-300 hover:text-slate-400"
                      />
                    </IconButton>
                  </div>
                )}
              </div>
              <div className="w-full py-2">
                <TextField
                  label="Destination"
                  value={destination}
                  required
                  autoFocus
                  variant="outlined"
                  onChange={(event) => {
                    setDestination(event.target.value ?? "");
                  }}
                  className="w-full"
                  disabled={Boolean(readOnly)}
                />
              </div>
              <div className="w-full py-2 flex">
                <FormControl className="w-full">
                  <InputLabel>Time Zone</InputLabel>
                  <Select
                    value={timeZone}
                    label="Time Zone"
                    onChange={(event: SelectChangeEvent) => {
                      setTimeZone(event.target.value);
                    }}
                    disabled={Boolean(readOnly)}
                  >
                    {Intl.supportedValuesOf("timeZone").map((tz) => (
                      <MenuItem key={tz} value={tz}>
                        {tz}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    <Link
                      href="https://www.zeitverschiebung.net/en/"
                      target="_blank"
                    >
                      Help: How to find my location's timezone?
                    </Link>
                  </FormHelperText>
                </FormControl>
                <div className="flex justify-center items-start ml-2">
                  <IconButton
                    color="primary"
                    className="w-14 h-14"
                    onClick={() =>
                      setTimeZone(
                        Intl.DateTimeFormat().resolvedOptions().timeZone
                      )
                    }
                    disabled={Boolean(readOnly)}
                  >
                    <MyLocationIcon fontSize="medium" />
                  </IconButton>
                </div>
              </div>
            </>
          )}
          <Divider className="my-2" />
          {(data.TYPE === BabyCareEventType.BOTTLE_FEED ||
            data.TYPE === BabyCareEventType.PUMPING ||
            data.TYPE === BabyCareEventType.PLAY ||
            data.TYPE === BabyCareEventType.SLEEP) && (
            <div className="w-full py-2">
              <OptionalNumberInput
                label="Duration"
                min={0}
                max={60}
                step={1}
                unit="min"
                factor={60 * 1000}
                value={duration}
                setValue={(value) => {
                  setDuration(value);
                }}
                className="flex-1"
                disabled={Boolean(readOnly)}
              />
            </div>
          )}
          <div className="w-full py-2">
            <TextField
              label="Comment"
              value={comment ?? ""}
              multiline
              rows={3}
              onChange={(event) => {
                setComment(event.target.value);
              }}
              variant="outlined"
              className="w-full"
              disabled={Boolean(readOnly)}
            />
          </div>
        </form>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        {!readOnly && (
          <Button
            variant="outlined"
            color="error"
            onClick={() => setShowDeleteConfirmationDialog(true)}
          >
            Remove
          </Button>
        )}
        {!readOnly && (
          <Button variant="contained" onClick={onSubmit}>
            Update
          </Button>
        )}
        {showDeleteConfirmationDialog && (
          <ConfirmationDialog
            open={showDeleteConfirmationDialog}
            onClose={() => setShowDeleteConfirmationDialog(false)}
            message="Are you sure you want to remove this event?"
            action={() => {
              let action: string;
              switch (data.TYPE) {
                case BabyCareEventType.BOTTLE_FEED: {
                  action = BabyCareAction.REMOVE_BOTTLE_FEED_EVENT;
                  break;
                }
                case BabyCareEventType.PUMPING: {
                  action = BabyCareAction.REMOVE_PUMPING_EVENT;
                  break;
                }
                case BabyCareEventType.NURSING: {
                  action = BabyCareAction.REMOVE_NURSING_EVENT;
                  break;
                }
                case BabyCareEventType.DIAPER_CHANGE: {
                  action = BabyCareAction.REMOVE_DIAPER_CHANGE_EVENT;
                  break;
                }
                case BabyCareEventType.PLAY: {
                  action = BabyCareAction.REMOVE_PLAY_EVENT;
                  break;
                }
                case BabyCareEventType.BATH: {
                  action = BabyCareAction.REMOVE_BATH_EVENT;
                  break;
                }
                case BabyCareEventType.SLEEP: {
                  action = BabyCareAction.REMOVE_SLEEP_EVENT;
                  break;
                }
                case BabyCareEventType.MEASUREMENT: {
                  action = BabyCareAction.REMOVE_MEASUREMENT_EVENT;
                  break;
                }
                case BabyCareEventType.MEDICINE: {
                  action = BabyCareAction.REMOVE_MEDICINE_EVENT;
                  break;
                }
                case BabyCareEventType.NOTE: {
                  action = BabyCareAction.REMOVE_NOTE_EVENT;
                  break;
                }
                case BabyCareEventType.TRAVEL: {
                  action = BabyCareAction.REMOVE_TRAVEL_EVENT;
                  break;
                }
                default:
                  return;
              }
              submit(
                {
                  __action: action,
                  ...data,
                },
                { method: HttpMethod.POST }
              );
              onClose();
            }}
          />
        )}
      </DialogActions>
    </Dialog>
  );
};
