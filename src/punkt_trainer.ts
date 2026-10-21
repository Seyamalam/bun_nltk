/** Training orchestration only; statistics and token annotation run in Rust. */
import { syncWasm } from "./sync_wasm";
import type { PunktModelSerialized, PunktTrainingOptions } from "./punkt";

export function trainPunkt(chunks: string[], options: PunktTrainingOptions = {}): PunktModelSerialized {
  return syncWasm().punktRequest({ op: "train", chunks, options }) as PunktModelSerialized;
}
