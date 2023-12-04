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
import { Form, useNavigation, useSubmit } from "@remix-run/react";
import { useState } from "react";
import { LoadingButton } from "@mui/lab";
import { NumberInput } from "../../shared/NumberInput";
import { DatePicker } from "@mui/x-date-pickers";

export const CREATE_PROFILE_SUBMIT_ACTION = "CREATE_PROFILE";
export const UPDATE_PROFILE_SUBMIT_ACTION = "UPDATE_PROFILE";

export const BabyCareProfileEditor = (props: {
  open: boolean;
  onClose: () => void;
  profile?: BabyCareProfile;
}) => {
  const { open, onClose, profile } = props;
  const submit = useSubmit();
  const { state } = useNavigation();
  const [name, setName] = useState(profile?.name ?? "");
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [gender, setGender] = useState(profile?.genderAtBirth ?? Gender.MALE);
  const [dob, setDob] = useState(profile?.dob ?? new Date());
  const [shortId, setShortId] = useState(profile?.shortId ?? "");
  const [milkVolume, setMilkVolume] = useState(
    profile?.defaultFeedingVolume ?? 0
  );
  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    submit(event.currentTarget);
  };

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
        method="post"
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
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
              variant="outlined"
              className="w-full"
            />
          </div>
          <div className="w-full py-2">
            <TextField
              label="Nickname"
              name="nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
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
              onChange={(value: Date | null) => setDob(value ?? new Date())}
              className="w-full"
            />
          </div>
          <div className="w-full py-2">
            <TextField
              label="Short ID"
              name="shortId"
              value={shortId}
              onChange={(event) => setShortId(event.target.value)}
              variant="outlined"
              className="w-full"
            />
          </div>
          <div className="w-full py-2">
            <NumberInput
              label="Feeding Milk Volume"
              name="defaultFeedingVolume"
              min={0}
              max={1000}
              step={5}
              unit="ml"
              value={milkVolume}
              setValue={(value) => setMilkVolume(value)}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton
            loading={state === "loading"}
            variant="contained"
            type="submit"
          >
            {profile ? "Update" : "Create"}
          </LoadingButton>
        </DialogActions>
      </Form>
    </Dialog>
  );
};
