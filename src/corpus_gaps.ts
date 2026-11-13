// Honest gap stubs for nltk.corpus/data/internals surfaces not yet ported.
// ConcatenatedCorpusView/tagged_treebank_para_block_reader graduated to real
// implementations; they re-export here so the root route stays stable.
export { ConcatenatedCorpusView, tagged_treebank_para_block_reader } from "./corpus_view";
export {
  ComparativeSentencesCorpusReader, Comparison, IEERCorpusReader, IEERDocument,
  IndianCorpusReader, IndianCorpusView, PPAttachment, PPAttachmentCorpusReader,
  ProsConsCorpusReader, Review, ReviewLine, ReviewsCorpusReader, TwitterCorpusReader,
} from "./corpus_readers2";
export {
  AlpinoCorpusReader, ChasenCorpusReader, ChasenCorpusView, ConllCorpusReader,
  ConllSRLInstance, ConllSRLInstanceList, KNBCorpusReader, LinThesaurusCorpusReader,
  SinicaTreebankCorpusReader, SwitchboardCorpusReader, SwitchboardTurn,
  ToolboxCorpusReader, YCOECorpusReader, YCOEParseCorpusReader, YCOETaggedCorpusReader,
  sinica_parse, knbc_test, chasen_test,
} from "./corpus_readers3";
export {
  ElementWrapper, xpath, XMLCorpusReader, XMLCorpusView, BNCSentence, BNCCorpusReader,
  BNCWordView, CHILDESCorpusReader, VerbnetCorpusReader, MTETagConverter, MTECorpusView,
  MTEFileReader, MTECorpusReader, IPIPANCorpusReader, IPIPANCorpusView, NKJPCorpusReader,
  NKJPCorpus_Header_View, XML_Tool, NKJPCorpus_Text_View, NKJPCorpus_Segmentation_View,
  NKJPCorpus_Morph_View, NPSChatCorpusReader, FramenetError, framenetProj, FramenetCorpusReader,
} from "./corpus_readers4";
export {
  PropbankCorpusReader, PropbankInstance, PropbankPointer, PropbankChainTreePointer,
  PropbankSplitTreePointer, PropbankTreePointer, PropbankInflection, NombankCorpusReader,
  NombankInstance, NombankPointer, NombankChainTreePointer, NombankSplitTreePointer,
  NombankTreePointer, SemcorCorpusReader, SemcorSentence, SemcorWordView, SensevalInstance,
  SensevalCorpusReader, SensevalCorpusView, RTEPair, RTECorpusReader, parse_xml_file,
} from "./corpus_readers5";
export {
  safe_parse, safe_fromstring, SpeakerInfo, TimitCorpusReader, read_timit_block, Meaning,
  PanLexLiteCorpusReader, PanlexLanguage, PanlexSwadeshCorpusReader, TEICorpusView,
  Pl196xCorpusReader, BCP47CorpusReader, CrubadanCorpusReader, norm,
  comma_separated_string_args, read_parse_blankline_block, MarkdownBlock, CodeBlock,
  MarkdownSection, Image, Link, List, MarkdownCorpusReader, CategorizedMarkdownCorpusReader,
  Future, AttrDict, SpecialList, PrettyDict, PrettyList, PrettyLazyMap,
  PrettyLazyIteratorList, PrettyLazyConcatenation,
} from "./corpus_readers6";
function unavailable(name: string): never { throw new Error(`nltk gap: ${name} is not implemented in the TS runtime`); }

export { BufferedGzipFile } from "./data";
export { Deprecated, ReadError, UntrustedJarError } from "./internals";
export {
  findFileIter as find_file_iter,
  isWritable as is_writable,
  readInt as read_int,
  readNumber as read_number,
  readStr as read_str,
} from "./internals";
export { ZipFile } from "./pathsec";
export class error { constructor(..._a: unknown[]) { unavailable("error"); } }
export class import_from_stdlib { constructor(..._a: unknown[]) { unavailable("import_from_stdlib"); } }
export class mimic_wrap { constructor(..._a: unknown[]) { unavailable("mimic_wrap"); } }
export class restricted_pickle_load { constructor(..._a: unknown[]) { unavailable("restricted_pickle_load"); } }
export { retrieve } from "./data";
export class switch_chunker { constructor(..._a: unknown[]) { unavailable("switch_chunker"); } }
export class switch_p_tagger { constructor(..._a: unknown[]) { unavailable("switch_p_tagger"); } }
export class switch_punkt { constructor(..._a: unknown[]) { unavailable("switch_punkt"); } }
export class switch_t_tagger { constructor(..._a: unknown[]) { unavailable("switch_t_tagger"); } }
export class test { constructor(..._a: unknown[]) { unavailable("test"); } }
export { urlopen } from "./pathsec";
export { validate_network_url, validate_network_url_async } from "./pathsec";
