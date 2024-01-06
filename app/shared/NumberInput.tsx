import {
  IconButton,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from "@mui/material";
import { Unstable_NumberInput as BaseNumberInput } from "@mui/base/Unstable_NumberInput";
import { AddCircleIcon, RemoveCircleIcon } from "./Icons";
import { isNonNullable } from "./AssertionUtils";
import { forwardRef } from "react";

export const NumberInput = forwardRef(function NumberInput(
  props: TextFieldProps & {
    label: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    factor?: number;
    value: number | undefined;
    setValue: (value: number) => void;
  },
  ref
) {
  const {
    label,
    min,
    max,
    step,
    unit,
    factor,
    value,
    setValue,
    // ...otherProps
  } = props;
  const _value = isNonNullable(value) ? value / (factor ?? 1) : undefined;
  const _setValue = (val: number) => {
    const _min = min ?? 0;
    const _max = max ?? Number.MAX_SAFE_INTEGER;
    const newValue = Math.max(_min, Math.min(_max, val)) * (factor ?? 1);
    // NOTE: trick to avoid floating point error in JS
    // See https://stackoverflow.com/questions/50778431/why-does-0-1-0-2-return-unpredictable-float-results-in-javascript-while-0-2
    // See https://stackoverflow.com/questions/11832914/how-to-round-to-at-most-2-decimal-places-if-necessary
    setValue((step ?? 1) % 1 !== 0 ? Math.round(newValue * 10) / 10 : newValue);
  };

  return (
    <div className="flex">
      <BaseNumberInput
        value={_value as number}
        onChange={(event, value) => {
          _setValue(value ?? 0);
        }}
        slots={{
          input: forwardRef(function NumberInputInput(_props, _ref) {
            return (
              <TextField
                ref={_ref}
                {..._props}
                variant="outlined"
                label={label}
                InputProps={
                  unit
                    ? {
                        startAdornment: (
                          <InputAdornment position="start">
                            {unit}
                          </InputAdornment>
                        ),
                      }
                    : {}
                }
              />
            );
          }),
        }}
      />
      <div className="flex justify-center items-center ml-2">
        <IconButton
          className="w-10 h-10"
          color="primary"
          onClick={() => _setValue((_value ?? 0) - (step ?? 1))}
        >
          <RemoveCircleIcon fontSize="large" className="text-blue-500" />
        </IconButton>
        <IconButton
          className="w-10 h-10"
          color="primary"
          onClick={() => _setValue((_value ?? 0) + (step ?? 1))}
        >
          <AddCircleIcon fontSize="large" className="text-blue-500" />
        </IconButton>
      </div>
    </div>
  );
});
