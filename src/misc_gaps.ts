// Honest unsupported stubs for misc modules: Python-introspection-bound
// decorators, HuggingFace network integration, and interactive demos.

function unavailable(name: string): never {
  throw new Error(`${name} is not supported in this runtime`);
}

// { nltk.decorators — signature-preserving decorator factory built on Python
//   function-introspection (inspect.getfullargspec / __dict__ copying), which
//   has no faithful JS analogue. The bare `decorator` name is bound by
//   src/decorators.ts's generic helper, so only the introspection helpers get
//   stubs here. }
export function getinfo(..._a: unknown[]): never { return unavailable("nltk.decorators.getinfo"); }
export function new_wrapper(..._a: unknown[]): never { return unavailable("nltk.decorators.new_wrapper"); }

// { nltk.huggingface.dataset — requires huggingface_hub + network. }
export class HFDatasetPathPointer {
  constructor(..._a: unknown[]) { unavailable("HFDatasetPathPointer"); }
}
export function hf_download(..._a: unknown[]): never { return unavailable("nltk.huggingface.dataset.download"); }
export function hf_load_data(..._a: unknown[]): never { return unavailable("nltk.huggingface.dataset.load_data"); }

// { nltk.toolbox.demo — interactive demo over the rotokas corpus resource. }
export function toolbox_demo(..._a: unknown[]): never { return unavailable("nltk.toolbox.demo"); }

// { nltk.chat demo wrappers — interactive menu. }
export function chatbots(..._a: unknown[]): never { return unavailable("nltk.chat.chatbots"); }
export function chat_demo(..._a: unknown[]): never { return unavailable("nltk.chat.demo"); }

// { nltk.twitter.common.outf_writer_compat — deprecated file-object shim. }
export function outf_writer_compat(..._a: unknown[]): never { return unavailable("nltk.twitter.common.outf_writer_compat"); }

// { nltk.twitter.api — twisted/reactor line receivers; network-bound. }
export class TweetHandlerI {
  constructor(..._a: unknown[]) { unavailable("TweetHandlerI"); }
}
export class BasicTweetHandler {
  constructor(..._a: unknown[]) { unavailable("BasicTweetHandler"); }
}
export class LocalTimezoneOffsetWithUTC {
  constructor(..._a: unknown[]) { unavailable("LocalTimezoneOffsetWithUTC"); }
}
