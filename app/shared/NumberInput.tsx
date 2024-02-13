import {
  IconButton,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from "@mui/material";
import { AddCircleIcon, CloseIcon, RemoveCircleIcon } from "./Icons";
import { isNonNullable } from "./AssertionUtils";
import { forwardRef, useCallback, useEffect, useState } from "react";
import { toNumber } from "lodash-es";

export const computeNewValue = (
  val: number,
  min: number | undefined,
  max: number | undefined,
  step: number | undefined
) => {
  const _min = min ?? 0;
  const _max = max ?? Number.MAX_SAFE_INTEGER;
  let newValue = Math.max(_min, Math.min(_max, val));
  // NOTE: trick to avoid floating point error in JS
  // See https://stackoverflow.com/questions/50778431/why-does-0-1-0-2-return-unpredictable-float-results-in-javascript-while-0-2
  // See https://stackoverflow.com/questions/11832914/how-to-round-to-at-most-2-decimal-places-if-necessary
  return (step ?? 1) % 1 !== 0 ? Math.round(newValue * 10) / 10 : newValue;
};

const BaseNumberInput = forwardRef(function NumberInput(
  props: TextFieldProps & {
    label: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    factor?: number;
    optional?: boolean;
    value: number | undefined;
    setValue: (value: number | undefined) => void;
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
    optional,
    setValue,
    disabled,
  } = props;
  const currentValue = isNonNullable(value) ? value / (factor ?? 1) : undefined;
  const [inputValue, setInputValue] = useState<string | number>(
    isNonNullable(value) ? value / (factor ?? 1) : ""
  );
  const _setValue = useCallback(
    (val: number) => {
      setValue(computeNewValue(val, min, max, step) * (factor ?? 1));
    },
    [setValue, factor, min, max, step]
  );
  const knobSetInputValue = (val: number) => {
    const newValue = computeNewValue(val, min, max, step);
    setValue(newValue * (factor ?? 1));
    setInputValue(newValue);
  };
  useEffect(() => {
    const numericValue = toNumber(inputValue);
    // NOTE: `toNumber` parses `""` as `0`, which is not what we want, so we want to do the explicit check here
    if (isNaN(numericValue) || !inputValue) {
      setValue(optional ? undefined : 0);
    } else {
      _setValue(numericValue);
    }
  }, [inputValue, setValue, _setValue, optional]);

  if (disabled) {
    return (
      <TextField
        inputMode="numeric"
        variant="outlined"
        className="w-full"
        label={label}
        value={inputValue}
        disabled={Boolean(disabled)}
        onChange={(event) => setInputValue(event.target.value)}
        InputProps={{
          startAdornment: unit ? (
            <InputAdornment position="start">{unit}</InputAdornment>
          ) : undefined,
        }}
        // probably better to use mui's NumberInput, but it currently does not support demical
        // See https://github.com/mui/material-ui/issues/38518
      />
    );
  }
  return (
    <div className="flex">
      <TextField
        inputMode="numeric"
        variant="outlined"
        className="w-full"
        label={label}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        InputProps={{
          classes: { root: optional ? "pr-1" : "" },
          startAdornment: unit ? (
            <InputAdornment position="start">{unit}</InputAdornment>
          ) : undefined,
          endAdornment: optional ? (
            <InputAdornment position="end">
              <IconButton onClick={() => setInputValue("")}>
                <CloseIcon />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        }}
        // probably better to use mui's NumberInput, but it currently does not support demical
        // See https://github.com/mui/material-ui/issues/38518
      />
      <div className="flex justify-center items-center ml-2">
        <IconButton
          className="w-10 h-10"
          color="primary"
          onClick={() => knobSetInputValue((currentValue ?? 0) - (step ?? 1))}
        >
          <RemoveCircleIcon fontSize="large" className="text-blue-500" />
        </IconButton>
        <IconButton
          className="w-10 h-10"
          color="primary"
          onClick={() => knobSetInputValue((currentValue ?? 0) + (step ?? 1))}
        >
          <AddCircleIcon fontSize="large" className="text-blue-500" />
        </IconButton>
      </div>
    </div>
  );
});

export const NumberInput = forwardRef(function NumberInput(
  props: TextFieldProps & {
    label: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    factor?: number;
    value: number;
    setValue: (value: number) => void;
  },
  ref
) {
  return (
    <BaseNumberInput
      ref={ref}
      {...props}
      setValue={(value: number | undefined) => props.setValue(value ?? 0)}
      optional={false}
    />
  );
});

export const OptionalNumberInput = forwardRef(function NumberInput(
  props: TextFieldProps & {
    label: string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    factor?: number;
    value: number | undefined;
    setValue: (value: number | undefined) => void;
  },
  ref
) {
  return <BaseNumberInput ref={ref} {...props} optional={true} />;
});
