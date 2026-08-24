// NLTK twitter.twitter_demo — shim
// Original: nltk/twitter/twitter_demo.py

function unavailable(name: string): never {
  throw new Error(`${name} requires twython/Twitter API — not available in JS`);
}

export function verbose(_fn: unknown): never { return unavailable("twitter.twitter_demo.verbose"); }
export function yesterday(): never { return unavailable("twitter.twitter_demo.yesterday"); }
export function setup(): never { return unavailable("twitter.twitter_demo.setup"); }
export function twitterclassDemo(): never { return unavailable("twitter.twitter_demo.twitterclass_demo"); }
export function sampletoscreenDemo(_limit?: number): never { return unavailable("twitter.twitter_demo.sampletoscreen_demo"); }
export function tracktoscreenDemo(_track?: string, _limit?: number): never { return unavailable("twitter.twitter_demo.tracktoscreen_demo"); }
export function searchDemo(_keywords?: string): never { return unavailable("twitter.twitter_demo.search_demo"); }
export function tweetsByUserDemo(_user?: string, _count?: number): never { return unavailable("twitter.twitter_demo.tweets_by_user_demo"); }
export function lookupByUseridDemo(): never { return unavailable("twitter.twitter_demo.lookup_by_userid_demo"); }
export function followtoscreenDemo(_limit?: number): never { return unavailable("twitter.twitter_demo.followtoscreen_demo"); }
export function streamtofileDemo(_limit?: number): never { return unavailable("twitter.twitter_demo.streamtofile_demo"); }
export function limitByTimeDemo(_keywords?: string): never { return unavailable("twitter.twitter_demo.limit_by_time_demo"); }
export function corpusreaderDemo(): never { return unavailable("twitter.twitter_demo.corpusreader_demo"); }
export function expandTweetidsDemo(): never { return unavailable("twitter.twitter_demo.expand_tweetids_demo"); }
