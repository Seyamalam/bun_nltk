/**
 * Port of nltk.sem.drt_glue_demo — GUI demo for Glue Semantics with DRT.
 *
 * Original is a tkinter GUI (DrtGlueDemo + DrsWidget + demo()). In bun_nltk
 * the GUI is not available (no tkinter/Canvas in JS). This port keeps the
 * data-flow and glue-parsing algorithms headless: example list, reading cache,
 * DrtGlue wiring, and navigation logic all work programmatically. Any method
 * that would open a Tk window throws a helpful error explaining the JS
 * alternative.
 */

import { DrtGlue } from "./sem_glue";
import { Variable } from "./sem_logic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function guiNotAvailable(method: string): never {
  throw new Error(
    `DrtGlueDemo.${method}: GUI not available in JS runtime (original uses tkinter). `
    + `Use DrtGlue directly: new DrtGlue({ depparser }).parseToMeaning(tokens) `
    + `or drive the headless demo via demoHeadless() / DrtGlueDemo.selectExample(). `
    + `For a visual DRS, use DrtParser + DRS.toString() / DRS.prettyFormat() from ./drt.`
  );
}

// ---------------------------------------------------------------------------
// DrsWidget — canvas rendering stub
// ---------------------------------------------------------------------------
export class DrsWidget {
  drs: unknown;
  canvas: unknown;
  bbox: [number, number, number, number] = [0, 0, 0, 0];

  constructor(canvas: unknown, drs: unknown) {
    // In Python this captures a Tk Canvas and renders via DrsDrawer.
    // In JS there is no Canvas — keep refs for API parity.
    this.canvas = canvas;
    this.drs = drs;
  }

  draw(): void {
    guiNotAvailable("DrsWidget.draw — use DrsDrawer from ./drt or DRS.prettyFormat() for headless rendering");
  }

  clear(): void {
    // no-op headless
  }
}

// ---------------------------------------------------------------------------
// DrtGlueDemo — headless core + GUI stubs
// ---------------------------------------------------------------------------
export interface DrtGlueDemoOptions {
  glue?: DrtGlue;
}

export class DrtGlueDemo {
  examples: string[];
  readingCache: Array<unknown[] | unknown | null>;
  curExample = -1;
  readings: unknown[] = [];
  drs: unknown = null;
  drsWidget: DrsWidget | null = null;
  error: unknown = null;

  // GUI-related state kept for parity (unused headless)
  showGrammar = true;
  size = 12;

  private glue: DrtGlue;

  constructor(examples: string[], opts: DrtGlueDemoOptions = {}) {
    this.examples = [...examples];
    this.readingCache = this.examples.map(() => null);
    this.glue = opts.glue ?? this.initGlue();
    // GUI init steps become no-ops / stubs in headless mode
    // (original calls _init_fonts, _init_menubar, _init_buttons, etc.)
  }

  /** Mirrors _init_glue — builds a RegexpTagger + MaltParser-backed DrtGlue in Python. */
  private initGlue(): DrtGlue {
    // RegexpTagger/MaltParser require NLTK corpora and Java — not available in JS.
    // Return a DrtGlue with no depparser; parse attempts will throw a helpful
    // corpus-missing error unless the caller injects a custom depparser.
    return new DrtGlue({ verbose: false });
  }

  // -- Headless programmatic API -------------------------------------------

  /** Parse an example string (space-separated) into DRS readings. Caches the result. */
  getReadingsForExample(example: string): unknown[] {
    try {
      const tokens = example.split(/\s+/).filter(Boolean);
      // DrtGlue.parseToMeaning requires a working depparser; if none was
      // injected this will throw a helpful error.
      const readings = (this.glue as unknown as { parseToMeaning(t: string[]): unknown[] }).parseToMeaning(tokens);
      return readings as unknown[];
    } catch (e) {
      throw new Error(
        `DrtGlueDemo: failed to parse "${example}" — ${(e as Error).message}. `
        + `Provide a depparser via new DrtGlueDemo(examples, { glue: new DrtGlue({ depparser: myParser }) }) `
        + `or call DrtGlueDemo with a custom glue instance.`
      );
    }
  }

  /** Select an example by index (mirrors _exampleList_store_selection). */
  selectExample(index: number): void {
    if (index < 0 || index >= this.examples.length) throw new RangeError(`Example index ${index} out of range`);
    this.curExample = index;
    const example = this.examples[index]!;
    const cached = this.readingCache[index];
    if (cached !== null && cached !== undefined) {
      if (Array.isArray(cached)) { this.readings = cached as unknown[]; this.error = null; }
      else { this.readings = []; this.error = cached; }
      return;
    }
    try {
      this.readings = this.getReadingsForExample(example);
      this.error = null;
      this.readingCache[index] = this.readings;
    } catch (e) {
      this.readings = [];
      // mimic Python's DrtVariableExpression(Variable("Error: ...")) sentinel
      try {
        const { DrtVariableExpression } = require("./drt") as { DrtVariableExpression(v: Variable): unknown };
        this.error = DrtVariableExpression(new Variable(`Error: ${(e as Error).message}`));
      } catch {
        this.error = e;
      }
      this.readingCache[index] = this.error;
    }
    this.drs = null;
  }

  /** Select a reading by index (mirrors _readingList_store_selection). */
  selectReading(index: number): void {
    const reading = this.readings[index];
    if (!reading) throw new RangeError(`Reading index ${index} out of range`);
    // In Python: reading.simplify().normalize().resolve_anaphora()
    try {
      const r = reading as { simplify(): { normalize(): { resolve_anaphora(): unknown } } };
      this.drs = r.simplify().normalize().resolve_anaphora();
    } catch {
      this.drs = reading;
    }
  }

  next(): void {
    if (this.readings.length > 0) {
      // if a reading is selected, advance; else select first
      // headless: just advance curExample if at end
      this.selectNextExample();
    } else {
      this.selectNextExample();
    }
  }

  prev(): void {
    this.selectPreviousExample();
  }

  private selectNextExample(): void {
    if (this.curExample < this.examples.length - 1) this.selectExample(this.curExample + 1);
    else this.selectExample(0);
  }

  private selectPreviousExample(): void {
    if (this.curExample > 0) this.selectExample(this.curExample - 1);
    else this.selectExample(this.examples.length - 1);
  }

  // -- GUI stubs (throw helpfully) -----------------------------------------

  destroy(..._args: unknown[]): void { guiNotAvailable("destroy"); }
  mainloop(..._args: unknown[]): void { guiNotAvailable("mainloop"); }
  resize(..._args: unknown[]): void { guiNotAvailable("resize"); }
  postscript(..._args: unknown[]): void { guiNotAvailable("postscript"); }
  about(..._args: unknown[]): void { guiNotAvailable("about"); }

  // Keep underscore-prefixed names for API parity (delegate to stubs or headless)
  _exampleList_select = guiNotAvailable.bind(null, "_exampleList_select");
  _readingList_select = guiNotAvailable.bind(null, "_readingList_select");
}

// Back-compat alias for the small frame wrapper referenced in some checklists
export class DrtGlueDemoFrame extends DrtGlueDemo {}

// ---------------------------------------------------------------------------
// Demo entry points
// ---------------------------------------------------------------------------

export function demo(): void {
  const examples = [
    "John walks",
    "David sees Mary",
    "David eats a sandwich",
    "every man chases a dog",
    "John chases himself",
  ];
  console.log("DrtGlueDemo — headless demo (GUI not available in JS).");
  console.log("Examples:", examples);
  console.log("To parse an example, inject a dependency parser:");
  console.log("  const glue = new DrtGlue({ depparser: myParser });");
  console.log("  const demo = new DrtGlueDemo(examples, { glue });");
  console.log("  demo.selectExample(0); console.log(demo.readings);");
  // Attempt a headless pass with the default (no-parser) glue to show the error path
  const d = new DrtGlueDemo(examples);
  for (let i = 0; i < examples.length; i++) {
    try {
      d.selectExample(i);
      console.log(`  [${i}] "${examples[i]}" — readings: ${d.readings.length}${d.error ? ` (error: ${String(d.error).slice(0, 120)})` : ""}`);
    } catch (e) {
      console.log(`  [${i}] "${examples[i]}" — ${(e as Error).message.slice(0, 200)}`);
    }
  }
}

/** Headless demo helper that accepts an injected DrtGlue with a working parser. */
export function demoHeadless(glue: DrtGlue, examples?: string[]): void {
  const exs = examples ?? ["John walks", "every man chases a dog"];
  const d = new DrtGlueDemo(exs, { glue });
  for (let i = 0; i < exs.length; i++) {
    d.selectExample(i);
    console.log(`Example ${i}: "${exs[i]}" — ${d.readings.length} reading(s)`);
    for (const r of d.readings) console.log(" ", String(r));
    if (d.error) console.log("  error:", String(d.error));
  }
}
