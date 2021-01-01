import { xregexp as XRegExp } from 'cspell-util-bundle';
import { genSequence, Sequence } from 'gensequence';
import * as Text from './text';
import * as path from 'path';
import { mkdirp } from 'fs-extra';
import * as Trie from 'cspell-trie-lib';
import { writeSeqToFile } from './fileWriter';
import { uniqueFilter } from 'hunspell-reader/dist/util';
import { extractInlineSettings, InlineSettings } from './inlineSettings';

const regNonWordOrSpace = XRegExp("[^\\p{L}' ]+", 'gi');
const regNonWordOrDigit = XRegExp("[^\\p{L}'0-9]+", 'gi');
const regExpSpaceOrDash = /[- ]+/g;
const regExpRepeatChars = /(.)\1{4,}/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Logger = (message?: any, ...optionalParams: any[]) => void;

let log: Logger = defaultLogger;

export function setLogger(logger?: Logger): void {
    log = logger ?? defaultLogger;
}

function defaultLogger(message?: unknown, ...optionalParams: unknown[]) {
    console.log(message, ...optionalParams);
}

type Normalizer = (lines: Sequence<string>) => Sequence<string>;
type LineProcessor = (line: string) => Iterable<string>;
type WordMapper = (word: string) => string;

export function legacyNormalizeWords(lines: Sequence<string>): Sequence<string> {
    return lines.concatMap((line) => legacyLineToWords(line));
}

export function legacyLineToWords(line: string): Sequence<string> {
    // Remove punctuation and non-letters.
    const filteredLine = line.replace(regNonWordOrSpace, '|');
    const wordGroups = filteredLine.split('|');

    const words = genSequence(wordGroups)
        .concatMap((a) => [a, ...a.split(regExpSpaceOrDash)])
        .concatMap((a) => splitCamelCase(a))
        .map((a) => a.trim())
        .filter((a) => !!a)
        .filter((s) => !regExpRepeatChars.test(s))
        .map((a) => a.toLowerCase());

    return words;
}

function splitCamelCase(word: string): Sequence<string> | string[] {
    const splitWords = Text.splitCamelCaseWord(word);
    // We only want to preserve this: "New York" and not "Namespace DNSLookup"
    if (splitWords.length > 1 && regExpSpaceOrDash.test(word)) {
        return genSequence(splitWords).concatMap((w) => w.split(regExpSpaceOrDash));
    }
    return splitWords;
}

export interface CompileOptions {
    skipNormalization: boolean | undefined;
    splitWords: boolean | undefined;
    keepCase: boolean;
    sort: boolean;
}

function createNormalizer(options: CompileOptions): Normalizer {
    const { skipNormalization = false, splitWords, keepCase } = options;
    if (skipNormalization) {
        return (lines: Sequence<string>) => lines;
    }
    const lineProcessor = splitWords === undefined ? legacyLineToWords : splitWords ? splitLine : noSplit;
    const wordMapper = keepCase ? mapWordIdentity : mapWordToLower;

    const initialState: CompilerState = {
        inlineSettings: {},
        lineProcessor,
        wordMapper,
    };

    return (lines: Iterable<string>) =>
        normalizeWordListSeq(lines, initialState)
            .filter((a) => !!a)
            .filter(uniqueFilter(10000));
}

export async function compileWordList(
    lines: Sequence<string>,
    destFilename: string,
    options: CompileOptions
): Promise<void> {
    const normalizer = createNormalizer(options);
    const seq = normalizer(lines);

    const finalSeq = options.sort ? genSequence(sort(seq)) : seq;

    return createWordListTarget(destFilename)(finalSeq);
}

export function createWordListTarget(destFilename: string): (seq: Sequence<string>) => Promise<void> {
    const target = createTarget(destFilename);
    return (seq: Sequence<string>) => target(seq.map((a) => a + '\n'));
}

function createTarget(destFilename: string): (seq: Sequence<string>) => Promise<void> {
    const destDir = path.dirname(destFilename);
    const pDir = mkdirp(destDir);
    return async (seq: Sequence<string>) => {
        await pDir;
        return writeSeqToFile(seq, destFilename);
    };
}

function mapWordToLower(a: string): string {
    return a.toLowerCase();
}

function mapWordIdentity(a: string): string {
    return a;
}
interface CompilerState {
    inlineSettings: InlineSettings;
    lineProcessor: LineProcessor;
    wordMapper: WordMapper;
}

function normalizeWordListSeq(lines: Iterable<string>, initialState: CompilerState): Sequence<string> {
    return genSequence(normalizeWordListGen(lines, initialState));
}

function* adjustComments(lines: Iterable<string>): Iterable<string> {
    for (const line of lines) {
        const idx = line.indexOf('#');
        if (idx <= 0) {
            yield line;
        } else {
            // Move the comment above.
            yield line.substr(idx);
            yield line.substr(0, idx);
        }
    }
}

function* normalizeWordListGen(lines: Iterable<string>, initialState: CompilerState): Iterable<string> {
    let state = initialState;

    for (const line of adjustComments(lines)) {
        state = adjustState(state, line);
        if (line[0] === '#') {
            yield line.trim();
            continue;
        }
        for (const word of state.lineProcessor(line)) {
            if (!word) continue;
            yield state.wordMapper(word).trim();
        }
    }
}

function adjustState(state: CompilerState, line: string): CompilerState {
    const inlineSettings = extractInlineSettings(line);
    if (!inlineSettings) return state;
    const r = { ...state };
    r.inlineSettings = { ...r.inlineSettings, ...inlineSettings };
    r.wordMapper =
        inlineSettings.keepCase === undefined
            ? r.wordMapper
            : inlineSettings.keepCase
            ? mapWordIdentity
            : mapWordToLower;
    r.lineProcessor = inlineSettings.split === undefined ? r.lineProcessor : inlineSettings.split ? splitLine : noSplit;
    return r;
}

function sort(words: Iterable<string>): Iterable<string> {
    return [...words].sort();
}

export interface TrieOptions {
    base?: number;
    trie3?: boolean;
}

export interface CompileTrieOptions extends CompileOptions, TrieOptions {}

export const consolidate = Trie.consolidate;

export async function compileTrie(
    words: Sequence<string>,
    destFilename: string,
    options: CompileTrieOptions
): Promise<void> {
    const normalizer = createNormalizer(options);
    await createTrieTarget(destFilename, options)(normalizer(words));
}

export function createTrieTarget(
    destFilename: string,
    options: TrieOptions
): (words: Sequence<string>) => Promise<void> {
    const target = createTarget(destFilename);
    return async (words: Sequence<string>) => {
        log('Reading Words into Trie');
        const base = options.base ?? 32;
        const version = options.trie3 ? 3 : 1;
        const root = Trie.buildTrie(words).root;
        log('Reduce duplicate word endings');
        const trie = consolidate(root);
        log(`Writing to file ${path.basename(destFilename)}`);
        await target(
            Trie.serializeTrie(trie, {
                base,
                comment: 'Built by cspell-tools.',
                version,
            })
        );
        log(`Done writing to file ${path.basename(destFilename)}`);
    };
}

/**
 * Splits a line of text into words, but does not split words.
 * @param line - text line to split.
 * @returns array of words
 * @example
 * ```
 * readline.clearLine(stream, dir) => ['readline', 'clearLine', 'stream', 'dir']
 * ```
 * @example
 * ```
 * New York => ['New', 'York']
 * ```
 * @example
 * ```
 * don't => ['don't']
 * ```
 * @example
 * ```
 * Event: 'SIGCONT'` => ['Event', 'SIGCONT']
 * ```
 */
function splitLine(line: string): string[] {
    line = line.replace(/#.*/, ''); // remove comment
    line = line.trim();
    line = line.replace(regNonWordOrDigit, '|');
    line = line.replace(/\W\d+\W/g, '|'); // remove isolated digits
    line = line.replace(/'(?=\|)/, ''); // remove trailing '
    line = line.replace(/'$/, ''); // remove trailing '
    line = line.replace(/(?<=\|)'/, ''); // remove leading '
    line = line.replace(/^'/, ''); // remove leading '
    line = line.replace(/\s*\|\s*/, '|'); // remove spaces around |
    line = line.replace(/[|]+/g, '|'); // reduce repeated |
    line = line.replace(/^\|/, ''); // remove leading |
    line = line.replace(/\|$/, ''); // remove trailing |
    return line.split('|').filter((a) => !!a);
}

function noSplit(line: string): string[] {
    return [line];
}

export const __testing__ = {
    splitLine: splitLine,
    createNormalizer,
};
