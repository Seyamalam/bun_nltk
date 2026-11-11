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
function unavailable(name: string): never { throw new Error(`nltk gap: ${name} is not implemented in the TS runtime`); }

export class AttrDict { constructor(..._a: unknown[]) { unavailable("AttrDict"); } }
export class BCP47CorpusReader { constructor(..._a: unknown[]) { unavailable("BCP47CorpusReader"); } }
export class BNCCorpusReader { constructor(..._a: unknown[]) { unavailable("BNCCorpusReader"); } }
export class BNCSentence { constructor(..._a: unknown[]) { unavailable("BNCSentence"); } }
export class BNCWordView { constructor(..._a: unknown[]) { unavailable("BNCWordView"); } }
export { BufferedGzipFile } from "./data";
export class CHILDESCorpusReader { constructor(..._a: unknown[]) { unavailable("CHILDESCorpusReader"); } }
export class CategorizedMarkdownCorpusReader { constructor(..._a: unknown[]) { unavailable("CategorizedMarkdownCorpusReader"); } }
export class CodeBlock { constructor(..._a: unknown[]) { unavailable("CodeBlock"); } }
export class CrubadanCorpusReader { constructor(..._a: unknown[]) { unavailable("CrubadanCorpusReader"); } }
export { Deprecated, ReadError, UntrustedJarError } from "./internals";
export {
  findFileIter as find_file_iter,
  isWritable as is_writable,
  readInt as read_int,
  readNumber as read_number,
  readStr as read_str,
} from "./internals";
export class ElementWrapper { constructor(..._a: unknown[]) { unavailable("ElementWrapper"); } }
export class FramenetCorpusReader { constructor(..._a: unknown[]) { unavailable("FramenetCorpusReader"); } }
export class FramenetError { constructor(..._a: unknown[]) { unavailable("FramenetError"); } }
export class Future { constructor(..._a: unknown[]) { unavailable("Future"); } }
export class IPIPANCorpusReader { constructor(..._a: unknown[]) { unavailable("IPIPANCorpusReader"); } }
export class IPIPANCorpusView { constructor(..._a: unknown[]) { unavailable("IPIPANCorpusView"); } }
export class Image { constructor(..._a: unknown[]) { unavailable("Image"); } }
export class Link { constructor(..._a: unknown[]) { unavailable("Link"); } }
export class List { constructor(..._a: unknown[]) { unavailable("List"); } }
export class MTECorpusReader { constructor(..._a: unknown[]) { unavailable("MTECorpusReader"); } }
export class MTECorpusView { constructor(..._a: unknown[]) { unavailable("MTECorpusView"); } }
export class MTEFileReader { constructor(..._a: unknown[]) { unavailable("MTEFileReader"); } }
export class MTETagConverter { constructor(..._a: unknown[]) { unavailable("MTETagConverter"); } }
export class MarkdownBlock { constructor(..._a: unknown[]) { unavailable("MarkdownBlock"); } }
export class MarkdownCorpusReader { constructor(..._a: unknown[]) { unavailable("MarkdownCorpusReader"); } }
export class MarkdownSection { constructor(..._a: unknown[]) { unavailable("MarkdownSection"); } }
export class Meaning { constructor(..._a: unknown[]) { unavailable("Meaning"); } }
export class NKJPCorpusReader { constructor(..._a: unknown[]) { unavailable("NKJPCorpusReader"); } }
export class NKJPCorpus_Header_View { constructor(..._a: unknown[]) { unavailable("NKJPCorpus_Header_View"); } }
export class NKJPCorpus_Morph_View { constructor(..._a: unknown[]) { unavailable("NKJPCorpus_Morph_View"); } }
export class NKJPCorpus_Segmentation_View { constructor(..._a: unknown[]) { unavailable("NKJPCorpus_Segmentation_View"); } }
export class NKJPCorpus_Text_View { constructor(..._a: unknown[]) { unavailable("NKJPCorpus_Text_View"); } }
export class NPSChatCorpusReader { constructor(..._a: unknown[]) { unavailable("NPSChatCorpusReader"); } }
export class NombankChainTreePointer { constructor(..._a: unknown[]) { unavailable("NombankChainTreePointer"); } }
export class NombankCorpusReader { constructor(..._a: unknown[]) { unavailable("NombankCorpusReader"); } }
export class NombankInstance { constructor(..._a: unknown[]) { unavailable("NombankInstance"); } }
export class NombankPointer { constructor(..._a: unknown[]) { unavailable("NombankPointer"); } }
export class NombankSplitTreePointer { constructor(..._a: unknown[]) { unavailable("NombankSplitTreePointer"); } }
export class NombankTreePointer { constructor(..._a: unknown[]) { unavailable("NombankTreePointer"); } }
export class PanLexLiteCorpusReader { constructor(..._a: unknown[]) { unavailable("PanLexLiteCorpusReader"); } }
export class PanlexLanguage { constructor(..._a: unknown[]) { unavailable("PanlexLanguage"); } }
export class PanlexSwadeshCorpusReader { constructor(..._a: unknown[]) { unavailable("PanlexSwadeshCorpusReader"); } }
export class Pl196xCorpusReader { constructor(..._a: unknown[]) { unavailable("Pl196xCorpusReader"); } }
export class PrettyDict { constructor(..._a: unknown[]) { unavailable("PrettyDict"); } }
export class PrettyLazyConcatenation { constructor(..._a: unknown[]) { unavailable("PrettyLazyConcatenation"); } }
export class PrettyLazyIteratorList { constructor(..._a: unknown[]) { unavailable("PrettyLazyIteratorList"); } }
export class PrettyLazyMap { constructor(..._a: unknown[]) { unavailable("PrettyLazyMap"); } }
export class PrettyList { constructor(..._a: unknown[]) { unavailable("PrettyList"); } }
export class PropbankChainTreePointer { constructor(..._a: unknown[]) { unavailable("PropbankChainTreePointer"); } }
export class PropbankCorpusReader { constructor(..._a: unknown[]) { unavailable("PropbankCorpusReader"); } }
export class PropbankInflection { constructor(..._a: unknown[]) { unavailable("PropbankInflection"); } }
export class PropbankInstance { constructor(..._a: unknown[]) { unavailable("PropbankInstance"); } }
export class PropbankPointer { constructor(..._a: unknown[]) { unavailable("PropbankPointer"); } }
export class PropbankSplitTreePointer { constructor(..._a: unknown[]) { unavailable("PropbankSplitTreePointer"); } }
export class PropbankTreePointer { constructor(..._a: unknown[]) { unavailable("PropbankTreePointer"); } }
export class RTECorpusReader { constructor(..._a: unknown[]) { unavailable("RTECorpusReader"); } }
export class RTEPair { constructor(..._a: unknown[]) { unavailable("RTEPair"); } }
export class SemcorCorpusReader { constructor(..._a: unknown[]) { unavailable("SemcorCorpusReader"); } }
export class SemcorSentence { constructor(..._a: unknown[]) { unavailable("SemcorSentence"); } }
export class SemcorWordView { constructor(..._a: unknown[]) { unavailable("SemcorWordView"); } }
export class SensevalCorpusReader { constructor(..._a: unknown[]) { unavailable("SensevalCorpusReader"); } }
export class SensevalCorpusView { constructor(..._a: unknown[]) { unavailable("SensevalCorpusView"); } }
export class SensevalInstance { constructor(..._a: unknown[]) { unavailable("SensevalInstance"); } }
export class SpeakerInfo { constructor(..._a: unknown[]) { unavailable("SpeakerInfo"); } }
export class SpecialList { constructor(..._a: unknown[]) { unavailable("SpecialList"); } }
export class TEICorpusView { constructor(..._a: unknown[]) { unavailable("TEICorpusView"); } }
export class TimitCorpusReader { constructor(..._a: unknown[]) { unavailable("TimitCorpusReader"); } }
export class VerbnetCorpusReader { constructor(..._a: unknown[]) { unavailable("VerbnetCorpusReader"); } }
export class XMLCorpusReader { constructor(..._a: unknown[]) { unavailable("XMLCorpusReader"); } }
export class XMLCorpusView { constructor(..._a: unknown[]) { unavailable("XMLCorpusView"); } }
export class XML_Tool { constructor(..._a: unknown[]) { unavailable("XML_Tool"); } }
export { ZipFile } from "./pathsec";
export class comma_separated_string_args { constructor(..._a: unknown[]) { unavailable("comma_separated_string_args"); } }
export class error { constructor(..._a: unknown[]) { unavailable("error"); } }
export class import_from_stdlib { constructor(..._a: unknown[]) { unavailable("import_from_stdlib"); } }
export class mimic_wrap { constructor(..._a: unknown[]) { unavailable("mimic_wrap"); } }
export class norm { constructor(..._a: unknown[]) { unavailable("norm"); } }
export class read_parse_blankline_block { constructor(..._a: unknown[]) { unavailable("read_parse_blankline_block"); } }
export class restricted_pickle_load { constructor(..._a: unknown[]) { unavailable("restricted_pickle_load"); } }
export { retrieve } from "./data";
export class safe_parse { constructor(..._a: unknown[]) { unavailable("safe_parse"); } }
export class switch_chunker { constructor(..._a: unknown[]) { unavailable("switch_chunker"); } }
export class switch_p_tagger { constructor(..._a: unknown[]) { unavailable("switch_p_tagger"); } }
export class switch_punkt { constructor(..._a: unknown[]) { unavailable("switch_punkt"); } }
export class switch_t_tagger { constructor(..._a: unknown[]) { unavailable("switch_t_tagger"); } }
export class test { constructor(..._a: unknown[]) { unavailable("test"); } }
export { urlopen } from "./pathsec";
export { validate_network_url, validate_network_url_async } from "./pathsec";
export class xpath { constructor(..._a: unknown[]) { unavailable("xpath"); } }
