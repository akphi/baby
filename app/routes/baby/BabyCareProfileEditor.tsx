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
} from "@mui/material";
import {
  type BabyCareProfile,
  Gender,
  BabyCareAction,
} from "../../data/baby-care";
import { useSubmit } from "@remix-run/react";
import { useState } from "react";
import { NumberInput } from "../../shared/NumberInput";
import { DatePicker } from "@mui/x-date-pickers";
import type { SerializeFrom } from "@remix-run/node";
import { parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { HttpMethod } from "../../shared/NetworkUtils";
import { pruneFormData } from "../../shared/FormDataUtils";

export const BabyCareProfileEditor = (props: {
  open: boolean;
  onClose: () => void;
  profile?: SerializeFrom<BabyCareProfile>;
}) => {
  const { open, onClose, profile } = props;
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
  const [nickname, setNickname] = useState(profile?.nickname);
  const [shortId, setShortId] = useState(profile?.shortId);
  const [defaultFeedingVolume, setDefaultFeedingVolume] = useState(
    profile?.defaultFeedingVolume
  );
  const [defaultPumpingDuration, setDefaultPumpingDuration] = useState(
    profile?.defaultPumpingDuration
  );
  const [defaultPumpingInterval, setDefaultPumpingInterval] = useState(
    profile?.defaultPumpingInterval
  );
  const [defaultFeedingInterval, setDefaultFeedingInterval] = useState(
    profile?.defaultFeedingInterval
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
        shortId,
        defaultFeedingVolume,
        defaultFeedingInterval,
        defaultPumpingDuration,
        defaultPumpingInterval,
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
              value={nickname}
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
              label="Short ID"
              value={shortId}
              onChange={(event) => {
                setShortId(event.target.value);
              }}
              variant="outlined"
              className="w-full"
            />
          </div>
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
        </form>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={onSubmit}>
          {profile ? "Update" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
