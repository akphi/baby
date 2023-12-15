import { returnUndefOnError } from "./shared/CommonUtils";
import {
  guaranteeIsNumber,
  guaranteeIsString,
  guaranteeIsBoolean,
  guaranteeIsObject,
  isNonNullable,
  guaranteeNonNullable,
} from "./shared/AssertionUtils";
import { createContext, useContext, useState } from "react";

type StoredValue = object | string | number | boolean;
type StorageStoreData = Record<PropertyKey, StoredValue>;

const DEFAULT_SETTINGS: StorageStoreData = {
  "unit.useMetric": true,
};

class SettingsStorage {
  private readonly data!: StorageStoreData;

  constructor() {
    const data = window.localStorage.getItem("settings");
    this.data = data
      ? returnUndefOnError(
          () => JSON.parse(data) as Record<string, StorageStoreData>
        ) ?? {}
      : {};
  }

  getValue(key: string): StoredValue | undefined {
    return this.data[key] ?? DEFAULT_SETTINGS[key];
  }

  getNumericValue(key: string): number | undefined {
    const value = this.getValue(key);
    return value !== undefined ? guaranteeIsNumber(value) : undefined;
  }

  getStringValue(key: string): string | undefined {
    const value = this.getValue(key);
    return value !== undefined ? guaranteeIsString(value) : undefined;
  }

  getBooleanValue(key: string): boolean | undefined {
    const value = this.getValue(key);
    return value !== undefined ? guaranteeIsBoolean(value) : undefined;
  }

  getObjectValue(key: string): object | undefined {
    const value = this.getValue(key);
    return value !== undefined ? guaranteeIsObject(value) : undefined;
  }

  hasValue(key: string): boolean {
    return isNonNullable(this.data[key]);
  }

  persistValue(key: string, value: StoredValue | undefined): void {
    if (value !== undefined) {
      this.data[key] = value;
    } else {
      delete this.data[key];
    }
    window.localStorage.setItem("settings", JSON.stringify(this.data));
  }
}

const SettingsStoreContext = createContext<SettingsStorage | undefined>(
  undefined
);

export function SettingsProvider(props: { children: React.ReactNode }) {
  return (
    <SettingsStoreContext.Provider value={new SettingsStorage()}>
      {props.children}
    </SettingsStoreContext.Provider>
  );
}

const useSettingsStorage = (): SettingsStorage =>
  guaranteeNonNullable(
    useContext(SettingsStoreContext),
    `Can't find settings storage in context`
  );

export const useStringSetting = (
  key: string
): [string | undefined, (value: string) => void] => {
  const storage = useSettingsStorage();
  const [value, setValue] = useState(storage.getStringValue(key));
  const persistValue = (value: string) => {
    storage.persistValue(key, value);
    setValue(value);
  };
  return [value, persistValue];
};

export const useNumericSetting = (
  key: string
): [number | undefined, (value: number) => void] => {
  const storage = useSettingsStorage();
  const [value, setValue] = useState(storage.getNumericValue(key));
  const persistValue = (value: number) => {
    storage.persistValue(key, value);
    setValue(value);
  };
  return [value, persistValue];
};

export const useBooleanSetting = (
  key: string
): [boolean | undefined, (value: boolean) => void] => {
  const storage = useSettingsStorage();
  const [value, setValue] = useState(storage.getBooleanValue(key));
  const persistValue = (value: boolean) => {
    storage.persistValue(key, value);
    setValue(value);
  };
  return [value, persistValue];
};
