import {
  IconButton,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from "@mui/material";
import { AddCircleIcon, RemoveCircleIcon } from "./Icons";

export const NumberInput = (
  props: TextFieldProps & {
    label: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    value: number;
    setValue: (value: number) => void;
  }
) => {
  const { label, min, max, step, unit, value, setValue, ...otherProps } = props;

  const _setValue = (value: number) => {
    const _min = min ?? 0;
    const _max = max ?? Number.MAX_SAFE_INTEGER;
    setValue(Math.max(_min, Math.min(_max, value)));
  };
  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = parseInt(event.target.value);
    newValue = isNaN(newValue) ? 0 : newValue;
    _setValue(newValue);
  };

  return (
    <div className="flex">
      <TextField
        label={label}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={onChange}
        InputProps={
          unit
            ? {
                startAdornment: (
                  <InputAdornment position="start">{unit}</InputAdornment>
                ),
              }
            : {}
        }
        {...otherProps}
      />
      <div className="flex justify-center items-center ml-2">
        <IconButton
          className="w-12 h-12"
          color="primary"
          onClick={() => _setValue(value - (step ?? 1))}
        >
          <RemoveCircleIcon fontSize="large" />
        </IconButton>
        <IconButton
          className="w-12 h-12"
          color="primary"
          onClick={() => _setValue(value + (step ?? 1))}
        >
          <AddCircleIcon fontSize="large" />
        </IconButton>
      </div>
    </div>
  );
};
