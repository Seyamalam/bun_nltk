// NLTK draw.util — shim (requires Tkinter)
// Original: nltk/draw/util.py

function unavailable(name: string): never {
  throw new Error(`${name} requires Tkinter — not available in JS`);
}

export class CanvasWidget { constructor(..._a: unknown[]) { unavailable("draw.util.CanvasWidget"); } }
export class TextWidget extends CanvasWidget {}
export class SymbolWidget extends TextWidget {}
export class AbstractContainerWidget extends CanvasWidget {}
export class BoxWidget extends AbstractContainerWidget {}
export class OvalWidget extends AbstractContainerWidget {}
export class ParenWidget extends AbstractContainerWidget {}
export class BracketWidget extends AbstractContainerWidget {}
export class SequenceWidget extends CanvasWidget {}
export class StackWidget extends CanvasWidget {}
export class SpaceWidget extends CanvasWidget {}
export class ScrollWatcherWidget extends CanvasWidget {}
export class CanvasFrame { constructor(..._a: unknown[]) { unavailable("draw.util.CanvasFrame"); } }
export class ShowText { constructor(..._a: unknown[]) { unavailable("draw.util.ShowText"); } }
export class EntryDialog { constructor(..._a: unknown[]) { unavailable("draw.util.EntryDialog"); } }
export class ColorizedList { constructor(..._a: unknown[]) { unavailable("draw.util.ColorizedList"); } }
export class MutableOptionMenu { constructor(..._a: unknown[]) { unavailable("draw.util.MutableOptionMenu"); } }
export function demo(): never { return unavailable("draw.util.demo"); }
