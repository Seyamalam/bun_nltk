import { expect, test } from "bun:test";
import { hmmViterbiIdsNative, kmeansFitEuclideanNative, linearTextTrainNative } from "../src/native";

const hmm = {
  symbolIds: Uint32Array.of(0, 0), stateCount: 2, symbolCount: 1,
  priors: Float32Array.of(0, -Infinity), transitions: Float32Array.of(0, 0, 0, 0), outputs: Float32Array.of(0, -Infinity),
};

test("native HMM validates dimensions and storage before processing", () => {
  for (const key of ["stateCount", "symbolCount"] as const) {
    for (const value of [0, -1, 1.5, NaN, Infinity, 2 ** 32 + 1]) {
      expect(() => hmmViterbiIdsNative({ ...hmm, [key]: value })).toThrow(RangeError);
    }
  }
  expect(() => hmmViterbiIdsNative({ ...hmm, stateCount: 0xffffffff })).toThrow(RangeError);
  expect(() => hmmViterbiIdsNative({ ...hmm, outputs: new Float32Array() })).toThrow("state/symbol");
  expect(() => hmmViterbiIdsNative({ ...hmm, symbolIds: Uint32Array.of(1) })).toThrow("symbolIds");
  expect(() => hmmViterbiIdsNative({ ...hmm, symbolIds: new Uint32Array(), stateCount: 0 })).toThrow(RangeError);
});

test("native HMM accepts negative infinity and ties but rejects NaN and positive infinity", () => {
  expect([...hmmViterbiIdsNative(hmm)]).toEqual([0, 0]);
  expect([...hmmViterbiIdsNative({ ...hmm, priors: Float32Array.of(-Infinity, -Infinity), transitions: new Float32Array(4).fill(-Infinity) })]).toEqual([0, 0]);
  for (const key of ["priors", "transitions", "outputs"] as const) {
    for (const value of [NaN, Infinity]) {
      const values = hmm[key].slice(); values[0] = value;
      expect(() => hmmViterbiIdsNative({ ...hmm, [key]: values })).toThrow("HMM log scores");
    }
  }
  expect(() => hmmViterbiIdsNative({ ...hmm, priors: Float32Array.of(3e38, 0), outputs: Float32Array.of(3e38, 0) })).toThrow();
});

const text = {
  texts: ["a"], labelIds: Uint32Array.of(0), classCount: 1, ngramMin: 1, ngramMax: 2,
  binary: false, maxFeatures: 10, algorithm: "logistic" as const, epochs: 1, learningRate: 0.1, l2: 0,
};

test("native text training validates options and labels before feature allocation", () => {
  for (const key of ["classCount", "ngramMin", "ngramMax", "maxFeatures", "epochs"] as const) {
    for (const value of [0, -1, 1.5, NaN, Infinity, 2 ** 32 + 1]) {
      expect(() => linearTextTrainNative({ ...text, [key]: value })).toThrow(RangeError);
    }
  }
  expect(() => linearTextTrainNative({ ...text, ngramMin: 3, ngramMax: 2 })).toThrow(RangeError);
  expect(() => linearTextTrainNative({ ...text, labelIds: Uint32Array.of(1) })).toThrow("labelIds");
  expect(() => linearTextTrainNative({ ...text, learningRate: NaN })).toThrow(RangeError);
  expect(() => linearTextTrainNative({ ...text, l2: Infinity })).toThrow(RangeError);
  expect(() => linearTextTrainNative({ ...text, margin: 0 })).toThrow(RangeError);
  expect(() => linearTextTrainNative({ ...text, algorithm: "unknown" as "svm" })).toThrow(TypeError);
});

test("native text training skips impossible ngram orders and supports empty text", () => {
  const model = linearTextTrainNative({ ...text, texts: ["a b"], ngramMax: 0xffffffff });
  expect(model.vocabulary).toEqual(["a", "a\u0001b", "b"]);
  const empty = linearTextTrainNative({ ...text, texts: [""], ngramMax: 0xffffffff });
  expect(empty.vocabulary).toEqual([]);
  expect(empty.weights.length).toBe(0);
  expect([...empty.bias]).toEqual([0.05]);
});

test("hardened HMM and k-means kernels retain NLTK 3.10.3 valid-input behavior", () => {
  let seed = 1337;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const hmms = Array.from({ length: 120 }, (_, index) => {
    const states = 1 + index % 6, symbols = 1 + index % 4, steps = 1 + index % 20;
    const score = () => Math.floor(random() * 20) - 20;
    return { states, symbols, sequence: Array.from({ length: steps }, () => Math.floor(random() * symbols)),
      priors: Array.from({ length: states }, score), transitions: Array.from({ length: states * states }, score), outputs: Array.from({ length: states * symbols }, score) };
  });
  const clusters = Array.from({ length: 60 }, (_, index) => {
    const dimensions = 1 + index % 4, count = 1 + index % 3;
    const means = Array.from({ length: count }, (_, c) => Array.from({ length: dimensions }, () => c * 50));
    const vectors = means.flatMap((mean) => Array.from({ length: 6 }, () => mean.map((v) => v + random() * 2 - 1)));
    return { means, vectors, avoidEmpty: index % 2 === 0 };
  });
  const python = Bun.spawnSync(["python3", "-c", `
import json,sys,nltk,numpy as np
from nltk.tag.hmm import HiddenMarkovModelTagger
from nltk.cluster import KMeansClusterer
from nltk.cluster.util import euclidean_distance
assert nltk.__version__ == '3.10.3', nltk.__version__
cases=json.load(sys.stdin)
paths=[]
for c in cases['hmms']:
 model=HiddenMarkovModelTagger.__new__(HiddenMarkovModelTagger)
 model._states=list(range(c['states']))
 model._cache=(np.array(c['priors'],dtype=np.float32),np.array(c['outputs'],dtype=np.float32).reshape(c['states'],c['symbols']),np.array(c['transitions'],dtype=np.float32).reshape(c['states'],c['states']),{s:s for s in range(c['symbols'])})
 model._create_cache=lambda:None
 model._update_cache=lambda sequence:None
 paths.append([int(v) for v in model._best_path(c['sequence'])])
means=[]
for c in cases['clusters']:
 model=KMeansClusterer(len(c['means']),euclidean_distance,initial_means=[np.array(m,dtype=np.float64) for m in c['means']],conv_test=1e-8,avoid_empty_clusters=c['avoidEmpty'])
 model.cluster_vectorspace(np.array(c['vectors']))
 means.append([list(map(float,m)) for m in model.means()])
print(json.dumps({'paths':paths,'means':means}))
`], { stdin: new TextEncoder().encode(JSON.stringify({ hmms, clusters })), stdout: "pipe", stderr: "pipe", timeout: 30_000 });
  if (python.exitCode !== 0) throw new Error(new TextDecoder().decode(python.stderr));
  const expected = JSON.parse(new TextDecoder().decode(python.stdout)) as { paths: number[][]; means: number[][][] };
  for (const [index, c] of hmms.entries()) {
    const actual = hmmViterbiIdsNative({ symbolIds: Uint32Array.from(c.sequence), stateCount: c.states, symbolCount: c.symbols,
      priors: Float32Array.from(c.priors), transitions: Float32Array.from(c.transitions), outputs: Float32Array.from(c.outputs) });
    expect([...actual], `HMM case ${index}`).toEqual(expected.paths[index]!);
  }
  for (const [index, c] of clusters.entries()) {
    const actual = kmeansFitEuclideanNative({ vectors: Float64Array.from(c.vectors.flat()), pointCount: c.vectors.length,
      dimensions: c.means[0]!.length, clusterCount: c.means.length, convergence: 1e-8,
      avoidEmptyClusters: c.avoidEmpty, initialMeans: Float64Array.from(c.means.flat()), maxIterations: 10_000 });
    for (const [j, value] of expected.means[index]!.flat().entries()) expect(Math.abs(actual.means[j]! - value)).toBeLessThan(1e-12);
  }
});
