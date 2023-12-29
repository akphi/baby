import { pickBy } from "lodash-es";
import { guaranteeIsString, guaranteeNonEmptyString } from "./AssertionUtils";
import { parseNumber, returnUndefOnError } from "./CommonUtils";

// submit function will automatically convert `null` and `undefined` into strings
// See https://developer.mozilla.org/en-US/docs/Web/API/FormData/append
export const pruneFormData = (data: Record<PropertyKey, unknown>): any =>
  pickBy(data, (val: unknown): boolean => val !== undefined && val !== null) as any;

export const extractRequiredString = (
  formData: FormData,
  key: string
): string => guaranteeIsString(formData.get(key), `'${key}' is missing`);

export const extractOptionalString = (
  formData: FormData,
  key: string
): string | undefined =>
  returnUndefOnError(() => extractRequiredString(formData, key));

export const extractRequiredNumber = (
  formData: FormData,
  key: string
): number =>
  parseNumber(
    guaranteeNonEmptyString(formData.get(key), `'${key}' is missing`)
  );

export const extractOptionalNumber = (
  formData: FormData,
  key: string
): number | undefined =>
  returnUndefOnError(() => extractRequiredNumber(formData, key));

export const extractRequiredBoolean = (
  formData: FormData,
  key: string
): boolean =>
  guaranteeNonEmptyString(formData.get(key), `'${key}' is missing`) === "true";

export const extractOptionalBoolean = (
  formData: FormData,
  key: string
): boolean | undefined =>
  returnUndefOnError(() => extractRequiredBoolean(formData, key));
