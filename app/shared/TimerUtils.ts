import { guaranteeNonNullable } from "./AssertionUtils";

export class StopWatch {
  private _startTime = Date.now();
  private _time = this._startTime;
  private _records = new Map<string, number>();

  record(event?: string | undefined): void {
    const currentTime = Date.now();
    const duration = currentTime - this._time;
    this._time = currentTime;
    if (event) {
      this._records.set(event, duration);
    }
  }

  getRecord(event: string): number {
    return guaranteeNonNullable(
      this._records.get(event),
      `Can't find record for event '${event}'`
    );
  }

  get startTime(): number {
    return this._startTime;
  }

  get elapsed(): number {
    return Date.now() - this._startTime;
  }

  get records(): Map<string, number> {
    return new Map(this._records);
  }
}
