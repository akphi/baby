import {
  IconButton,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from "@mui/material";
import { AddCircleIcon, RemoveCircleIcon } from "./Icons";
import { isNonNullable } from "./AssertionUtils";

export const NumberInput = (
  props: TextFieldProps & {
    label: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    factor?: number;
    value: number | undefined;
    setValue: (value: number) => void;
  }
) => {
  const {
    label,
    min,
    max,
    step,
    unit,
    factor,
    value,
    setValue,
    ...otherProps
  } = props;
  const _value = isNonNullable(value) ? value / (factor ?? 1) : undefined;
  const _setValue = (val: number) => {
    const _min = min ?? 0;
    const _max = max ?? Number.MAX_SAFE_INTEGER;
    setValue(Math.max(_min, Math.min(_max, val)) * (factor ?? 1));
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
        value={_value ?? ""}
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
          onClick={() => _setValue((_value ?? 0) - (step ?? 1))}
        >
          <RemoveCircleIcon fontSize="large" />
        </IconButton>
        <IconButton
          className="w-12 h-12"
          color="primary"
          onClick={() => _setValue((_value ?? 0) + (step ?? 1))}
        >
          <AddCircleIcon fontSize="large" />
        </IconButton>
      </div>
    </div>
  );
};
