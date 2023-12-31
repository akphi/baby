import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  type SelectChangeEvent,
  Divider,
  Slider,
} from "@mui/material";
import {
  type BabyCareProfile,
  Gender,
  BabyCareAction,
} from "../../data/BabyCare";
import {
  DEFAULT_FEEDING_VOLUME,
  DEFAULT_FEEDING_INTERVAL,
  DEFAULT_NIGHT_FEEDING_INTERVAL,
  DEFAULT_PUMPING_DURATION,
  DEFAULT_PUMPING_INTERNAL,
  DEFAULT_NIGHT_PUMPING_INTERNAL,
  DEFAULT_BABY_DAYTIME_START_HOUR,
  DEFAULT_BABY_DAYTIME_END_HOUR,
  DEFAULT_PARENT_DAYTIME_START_HOUR,
  DEFAULT_PARENT_DAYTIME_END_HOUR,
  DAYTIME_MINUNIMUM_DURATION,
} from "../../data/constants";
import { useSubmit } from "@remix-run/react";
import { useState } from "react";
import { NumberInput } from "../../shared/NumberInput";
import { DatePicker } from "@mui/x-date-pickers";
import type { SerializeFrom } from "@remix-run/node";
import { parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { HttpMethod } from "../../shared/NetworkUtils";
import { pruneFormData } from "../../shared/FormDataUtils";
import { ConfirmationDialog } from "../../shared/ConfirmationDialog";
import { getNonNullableEntry } from "../../shared/CommonUtils";
import { generateHourText } from "../../data/BabyCareUtils";

const HourRangeSlider = (props: {
  label: string;
  lowerValue: number;
  upperValue: number;
  setLowerValue: (value: number) => void;
  setUpperValue: (value: number) => void;
}) => {
  const { label, lowerValue, upperValue, setLowerValue, setUpperValue } = props;
  const [values, _setValues] = useState<number[]>([lowerValue, upperValue]);

  const setValues = (lower: number, upper: number) => {
    _setValues([lower, upper]);
    setLowerValue(lower);
    setUpperValue(upper);
  };

  const handleChange = (
    event: Event,
    newValues: number | number[],
    activeThumb: number
  ) => {
    if (!Array.isArray(newValues)) {
      return;
    }
    const DIFF = DAYTIME_MINUNIMUM_DURATION;
    const MIN = 0;
    const MAX = 24;

    const lower = getNonNullableEntry(values, 0);
    const upper = getNonNullableEntry(values, 1);
    const newLower = getNonNullableEntry(newValues, 0);
    const newUpper = getNonNullableEntry(newValues, 1);

    if (activeThumb === 0) {
      const low = Math.min(Math.max(newLower, MIN), MAX - DIFF);
      const high = Math.max(
        Math.min(upper - DIFF > low ? upper : low + DIFF, MAX),
        MIN + DIFF
      );
      setValues(low, high);
    } else {
      const high = Math.max(Math.min(newUpper, MAX), MIN + DIFF);
      const low = Math.min(
        Math.max(high - DIFF > lower ? lower : high - DIFF, MIN),
        MAX - DIFF
      );
      setValues(low, high);
    }
  };

  return (
    <div className="">
      <div className="flex items-center">
        <div className="text-slate-700">{label}</div>
        <div className="text-2xs py-0.5 px-1 bg-slate-100 rounded -top-1 border border-slate-500 before:hidden text-slate-500 font-mono font-medium ml-2">{`${generateHourText(
          values[0] as number
        )} - ${generateHourText(values[1] as number)}`}</div>
      </div>
      <div className="px-2 mt-1">
        <Slider
          value={values}
          onChange={handleChange}
          valueLabelDisplay="auto"
          classes={{
            root: "h-1",
            thumb: "bg-blue-500 after:w-7 after:h-7",
            markLabel: "text-2xs font-mono font-medium text-slate-700",
            track: "border-none bg-blue-500",
            rail: "rounded-none bg-slate-300 opacity-50",
            mark: "h-2 w-[1.5px] bg-slate-300",
            markActive: "!bg-blue-500 opacity-100",
            valueLabel:
              "text-2xs py-0.5 px-1 bg-slate-100 rounded -top-1 border border-blue-500 before:hidden text-blue-500 font-mono font-medium",
          }}
          valueLabelFormat={generateHourText}
          marks={[
            {
              value: 0,
              label: "12AM",
            },
            {
              value: 3,
              label: "3AM",
            },
            {
              value: 6,
              label: "6AM",
            },
            {
              value: 9,
              label: "9AM",
            },
            {
              value: 12,
              label: "12PM",
            },
            {
              value: 15,
              label: "3PM",
            },
            {
              value: 18,
              label: "6PM",
            },
            {
              value: 21,
              label: "9PM",
            },
            {
              value: 24,
              label: "12AM",
            },
          ]}
          min={0}
          step={0.5}
          max={24}
          disableSwap
        />
      </div>
    </div>
  );
};

export const BabyCareProfileEditor = (props: {
  open: boolean;
  onClose: () => void;
  profile?: SerializeFrom<BabyCareProfile>;
}) => {
  const { open, onClose, profile } = props;
  const [showDeleteConfirmationDialog, setShowDeleteConfirmationDialog] =
    useState(false);
  const submit = useSubmit();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const [name, setName] = useState(profile?.name ?? "");
  const [gender, setGender] = useState(profile?.genderAtBirth ?? Gender.MALE);
  const [dob, setDob] = useState(
    profile?.dob ? parseISO(profile?.dob) : new Date()
  );
  const [nickname, setNickname] = useState(profile?.nickname); // optional
  const [handle, setHandle] = useState(profile?.handle); // optional

  // feeding
  const [defaultFeedingVolume, setDefaultFeedingVolume] = useState(
    profile?.defaultFeedingVolume ?? DEFAULT_FEEDING_VOLUME
  );
  const [defaultFeedingInterval, setDefaultFeedingInterval] = useState(
    profile?.defaultFeedingInterval ?? DEFAULT_FEEDING_INTERVAL
  );
  const [defaultNightFeedingInterval, setDefaultNightFeedingInterval] =
    useState(
      profile?.defaultNightFeedingInterval ?? DEFAULT_NIGHT_FEEDING_INTERVAL
    );

  // pumping
  const [defaultPumpingDuration, setDefaultPumpingDuration] = useState(
    profile?.defaultPumpingDuration ?? DEFAULT_PUMPING_DURATION
  );
  const [defaultPumpingInterval, setDefaultPumpingInterval] = useState(
    profile?.defaultPumpingInterval ?? DEFAULT_PUMPING_INTERNAL
  );
  const [defaultNightPumpingInterval, setDefaultNightPumpingInterval] =
    useState(
      profile?.defaultNightPumpingInterval ?? DEFAULT_NIGHT_PUMPING_INTERNAL
    );

  // timing
  const [babyDaytimeStart, setBabyDaytimeStart] = useState(
    profile?.babyDaytimeStart ?? DEFAULT_BABY_DAYTIME_START_HOUR
  );
  const [babyDaytimeEnd, setBabyDaytimeEnd] = useState(
    profile?.babyDaytimeEnd ?? DEFAULT_BABY_DAYTIME_END_HOUR
  );

  const [parentDaytimeStart, setParentDaytimeStart] = useState(
    profile?.parentDaytimeStart ?? DEFAULT_PARENT_DAYTIME_START_HOUR
  );
  const [parentDaytimeEnd, setParentDaytimeEnd] = useState(
    profile?.parentDaytimeEnd ?? DEFAULT_PARENT_DAYTIME_END_HOUR
  );

  const onSubmit = handleSubmit((data, event) => {
    submit(
      pruneFormData({
        __action: profile
          ? BabyCareAction.UPDATE_PROFILE
          : BabyCareAction.CREATE_PROFILE,
        ...profile,
        id: profile?.id,
        name,
        gender,
        dob: dob.toISOString(),
        nickname,
        handle,

        defaultFeedingVolume,
        defaultFeedingInterval,
        defaultNightFeedingInterval,

        defaultPumpingDuration,
        defaultPumpingInterval,
        defaultNightPumpingInterval,

        babyDaytimeStart,
        babyDaytimeEnd,
        parentDaytimeStart,
        parentDaytimeEnd,
      }),
      { method: HttpMethod.POST }
    );
    onClose();
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      // NOTE: workaround to make autofocus work properly with dialog
      // See https://github.com/mui/material-ui/issues/33004#issuecomment-1473299089
      disableRestoreFocus={true}
      hideBackdrop={true}
    >
      <DialogTitle>
        {profile ? `👶 Update Baby Profile` : `👶 New Baby Profile`}
      </DialogTitle>
      <DialogContent dividers>
        <form
          onSubmit={onSubmit}
          method={HttpMethod.POST}
          autoComplete="off"
          noValidate
        >
          <div className="w-full py-2">
            <TextField
              label="Name"
              value={name}
              required
              autoFocus
              variant="outlined"
              error={Boolean(errors.name)}
              className="w-full"
              helperText={errors.name ? "Name is required" : undefined}
              {...register("name", {
                required: true,
                onChange: (event) => {
                  setName(event.target.value);
                },
              })}
            />
          </div>
          <div className="w-full py-2">
            <TextField
              label="Nickname"
              name="nickname"
              value={nickname ?? ""}
              onChange={(event) => {
                setNickname(event.target.value);
              }}
              variant="outlined"
              className="w-full"
            />
          </div>
          <div className="w-full py-2">
            <FormControl className="w-full">
              <InputLabel>Gender</InputLabel>
              <Select
                value={gender}
                label="Gender"
                name="gender"
                onChange={(event: SelectChangeEvent) => {
                  setGender(event.target.value as Gender);
                }}
              >
                <MenuItem value={Gender.MALE}>Male</MenuItem>
                <MenuItem value={Gender.FEMALE}>Female</MenuItem>
              </Select>
            </FormControl>
          </div>
          <div className="w-full py-2">
            <DatePicker
              label="Date of Birth"
              value={dob}
              onChange={(value: Date | null) => {
                setDob(value ?? new Date());
              }}
              className="w-full"
            />
          </div>
          <div className="w-full py-2">
            <TextField
              label="Handle"
              value={handle ?? ""}
              onChange={(event) => {
                setHandle(event.target.value);
              }}
              variant="outlined"
              className="w-full"
            />
          </div>
          <Divider className="my-2" />
          <div className="w-full py-2">
            <NumberInput
              label="Feeding Volume"
              min={0}
              max={1000}
              step={5}
              unit="ml"
              value={defaultFeedingVolume}
              setValue={(value) => {
                setDefaultFeedingVolume(value);
              }}
              className="flex-1"
            />
          </div>
          <div className="w-full py-2">
            <NumberInput
              label="Feeding Interval"
              min={0}
              max={12}
              step={0.5}
              unit="hr"
              factor={60 * 60 * 1000}
              value={defaultFeedingInterval}
              setValue={(value) => {
                setDefaultFeedingInterval(value);
              }}
              className="flex-1"
            />
          </div>
          <div className="w-full py-2">
            <NumberInput
              label="Feeding Interval (Night)"
              min={0}
              max={12}
              step={0.5}
              unit="hr"
              factor={60 * 60 * 1000}
              value={defaultNightFeedingInterval}
              setValue={(value) => {
                setDefaultNightFeedingInterval(value);
              }}
              className="flex-1"
            />
          </div>
          <Divider className="my-2" />
          <div className="w-full py-2">
            <NumberInput
              label="Pumping Duration"
              min={0}
              max={60}
              step={5}
              unit="min"
              factor={60 * 1000}
              value={defaultPumpingDuration}
              setValue={(value) => {
                setDefaultPumpingDuration(value);
              }}
              className="flex-1"
            />
          </div>
          <div className="w-full py-2">
            <NumberInput
              label="Pumping Interval"
              min={0}
              max={12}
              step={0.5}
              unit="hr"
              factor={60 * 60 * 1000}
              value={defaultPumpingInterval}
              setValue={(value) => {
                setDefaultPumpingInterval(value);
              }}
              className="flex-1"
            />
          </div>
          <div className="w-full py-2">
            <NumberInput
              label="Pumping Interval (Night)"
              min={0}
              max={12}
              step={0.5}
              unit="hr"
              factor={60 * 60 * 1000}
              value={defaultNightPumpingInterval}
              setValue={(value) => {
                setDefaultNightPumpingInterval(value);
              }}
              className="flex-1"
            />
          </div>
          <Divider className="my-2" />
          <div className="w-full py-2">
            <HourRangeSlider
              label="Baby Daytime"
              lowerValue={babyDaytimeStart}
              upperValue={babyDaytimeEnd}
              setLowerValue={(value) => setBabyDaytimeStart(value)}
              setUpperValue={(value) => setBabyDaytimeEnd(value)}
            />
          </div>
          <div className="w-full py-2">
            <HourRangeSlider
              label="Parent Daytime"
              lowerValue={parentDaytimeStart}
              upperValue={parentDaytimeEnd}
              setLowerValue={(value) => setParentDaytimeStart(value)}
              setUpperValue={(value) => setParentDaytimeEnd(value)}
            />
          </div>
        </form>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          color="error"
          onClick={() => setShowDeleteConfirmationDialog(true)}
        >
          Remove
        </Button>
        <Button variant="contained" onClick={onSubmit}>
          {profile ? "Update" : "Create"}
        </Button>
        {showDeleteConfirmationDialog && (
          <ConfirmationDialog
            open={showDeleteConfirmationDialog}
            onClose={() => setShowDeleteConfirmationDialog(false)}
            message="All logs and data associated with this profile will be permanently removed. Do you want to proceed?"
            action={() => {
              if (!profile) {
                return;
              }
              submit(
                {
                  __action: BabyCareAction.REMOVE_PROFILE,
                  id: profile.id,
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
