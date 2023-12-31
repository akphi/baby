import { useEffect, useRef, useState } from "react";
import { useEventSource } from "remix-utils/sse/react";
import { BabyCareServerEvent } from "../../data/BabyCare";

export class BabyCareProfileSyncPulseData {
  sseData: string;
  timestamp: number;
  profileId: string;

  constructor(sseData: string) {
    this.sseData = sseData;
    const idx = sseData.indexOf(":");
    this.timestamp = parseInt(sseData.substring(0, idx));
    this.profileId = sseData.substring(idx + 1);
  }
}

// NOTE: server-sent events mechanism will keep broadcasting the same event
// so we need to "hack" it by keeping track of the timestamp of the event
export const useBabyCareProfileSyncPulse = (
  id?: string | undefined
): [{ timestamp: number; profileId: string } | undefined, () => void] => {
  const pulses = useRef(new Map<string, BabyCareProfileSyncPulseData>());
  const [pulseData, setPulseData] = useState<
    BabyCareProfileSyncPulseData | undefined
  >(undefined);
  const sseData = useEventSource("/baby/sse", {
    event: BabyCareServerEvent.PROFILE_DATA_CHANGE,
  });

  useEffect(() => {
    if (sseData) {
      const newPulseData = new BabyCareProfileSyncPulseData(sseData);
      if (!id || newPulseData.profileId === id) {
        if (pulses.current.has(sseData)) {
          setPulseData(undefined);
        } else {
          pulses.current.set(sseData, newPulseData);
          // prevent building up too many pulses, but leave room for collision, i.e. multiple pulses coming at the same moment
          pulses.current.forEach((value, key) => {
            if (value.timestamp < newPulseData.timestamp) {
              pulses.current.delete(key);
            }
          });
          setPulseData(newPulseData);
        }
      } else {
        setPulseData(undefined);
      }
    }
  }, [sseData, id]);

  return [pulseData, () => setPulseData(undefined)];
};
