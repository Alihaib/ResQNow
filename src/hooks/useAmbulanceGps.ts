import { useSyncExternalStore } from "react";
import {
  getAmbulanceGpsSnapshot,
  subscribeAmbulanceGps,
} from "../services/ambulanceGpsService";

/** Subscribes to mission-level ambulance GPS state (survives navigation). */
export function useAmbulanceGps() {
  return useSyncExternalStore(subscribeAmbulanceGps, getAmbulanceGpsSnapshot, getAmbulanceGpsSnapshot);
}
