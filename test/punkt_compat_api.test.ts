import { expect, test } from "bun:test";
import {
  defaultPunktModel,
  PunktSentenceTokenizer,
  PunktTrainer,
  sentenceTokenizePunkt,
  sentenceTokenizePunktCompat,
} from "../index";

test("Punkt compatibility wrappers expose trainer/tokenizer API", () => {
  const trainer = new PunktTrainer();
  trainer.loadTrainText("Dr. Smith arrived. Dr. Adams left at 5 p.m.");
  const model = trainer.finalize();
  expect(model.abbreviations.length).toBeGreaterThan(0);

  const tokenizer = new PunktSentenceTokenizer(model);
  const rows = tokenizer.tokenize("Dr. Smith arrived. He left.");
  expect(rows.length).toBe(2);
});

test("sentenceTokenizePunktCompat uses non-native punkt path", () => {
  const text = "Dr. Adams spoke. Ms. Gray replied.";
  const model = defaultPunktModel();
  const compat = sentenceTokenizePunktCompat(text, model);
  const nativeOrModel = sentenceTokenizePunkt(text, model);
  expect(compat).toEqual(nativeOrModel);
});
