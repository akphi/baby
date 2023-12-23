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
import { type BabyCareProfile, Gender } from "../../data/baby-care";
import { Form, useSubmit } from "@remix-run/react";
import { useState } from "react";
import { NumberInput } from "../../shared/NumberInput";
import { DatePicker } from "@mui/x-date-pickers";
import type { SerializeFrom } from "@remix-run/node";
import { parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { HttpMethod } from "../../shared/NetworkUtils";

export const CREATE_PROFILE_SUBMIT_ACTION = "CREATE_PROFILE";
export const UPDATE_PROFILE_SUBMIT_ACTION = "UPDATE_PROFILE";
export const REMOVE_PROFILE_SUBMIT_ACTION = "REMOVE_PROFILE";

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
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [shortId, setShortId] = useState(profile?.shortId ?? "");
  const [feedingVolume, setFeedingVolume] = useState(
    profile?.defaultFeedingVolume ?? 0
  );
  const [pumpingDuration, setPumpingDuration] = useState(
    profile?.defaultPumpingDuration ?? 0
  );
  const [feedingInterval, setFeedingInterval] = useState(
    profile?.feedingInterval ?? 0
  );
  const onSubmit: React.FormEventHandler<HTMLFormElement> = handleSubmit(
    (data, event) => {
      submit(event?.target);
      onClose();
    }
  );

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
      <Form
        onSubmit={onSubmit}
        method={HttpMethod.POST}
        autoComplete="off"
        noValidate
        className="flex-col"
      >
        <DialogContent dividers>
          <input name="id" type="hidden" value={profile?.id} />
          <input
            name="action"
            type="hidden"
            value={
              profile
                ? UPDATE_PROFILE_SUBMIT_ACTION
                : CREATE_PROFILE_SUBMIT_ACTION
            }
          />
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
              slotProps={{ textField: { name: "dob" } }}
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
              name="shortId"
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
              name="defaultFeedingVolume"
              min={0}
              max={1000}
              step={5}
              unit="ml"
              value={feedingVolume}
              setValue={(value) => {
                setFeedingVolume(value);
              }}
              className="flex-1"
            />
          </div>
          <div className="w-full py-2">
            <NumberInput
              label="Pumping Duration"
              name="defaultPumpingDuration"
              min={0}
              max={60}
              step={5}
              unit="min"
              value={pumpingDuration}
              setValue={(value) => {
                setPumpingDuration(value);
              }}
              className="flex-1"
            />
          </div>
          <div className="w-full py-2">
            <NumberInput
              label="Feeding Interval"
              name="feedingInterval"
              min={0}
              max={12}
              step={0.5}
              unit="hr"
              value={feedingInterval}
              setValue={(value) => {
                setFeedingInterval(value);
              }}
              className="flex-1"
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="contained" type="submit">
            {profile ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
};
