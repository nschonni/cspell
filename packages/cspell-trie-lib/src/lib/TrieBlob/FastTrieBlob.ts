import type { ITrieNode, ITrieNodeRoot } from '../ITrieNode/ITrieNode.js';
import { findNode } from '../ITrieNode/trie-util.js';
import type { PartialTrieInfo, TrieInfo } from '../ITrieNode/TrieInfo.js';
import type { TrieData } from '../TrieData.js';
import { mergeOptionalWithDefaults } from '../utils/mergeOptionalWithDefaults.js';
import { extractInfo, type FastTrieBlobBitMaskInfo } from './FastTrieBlobBitMaskInfo.js';
import { FastTrieBlobInternals } from './FastTrieBlobInternals.js';
import { FastTrieBlobIRoot } from './FastTrieBlobIRoot.js';
import { NumberSequenceByteDecoderAccumulator } from './NumberSequenceByteDecoderAccumulator.js';
import { TrieBlob } from './TrieBlob.js';

type FastTrieBlobNode = number[];

type CharIndexMap = Record<string, number>;

export class FastTrieBlob implements TrieData {
    private _charToIndexMap: CharIndexMap;
    private _readonly = false;
    private _forbidIdx: number;
    private _iTrieRoot: ITrieNodeRoot | undefined;
    wordToCharacters: (word: string) => readonly string[];

    readonly info: Readonly<TrieInfo>;

    private constructor(
        private nodes: FastTrieBlobNode[],
        private _charIndex: readonly string[],
        readonly bitMasksInfo: FastTrieBlobBitMaskInfo,
        options?: PartialTrieInfo,
    ) {
        this.info = mergeOptionalWithDefaults(options);
        this.wordToCharacters = (word: string) => [...word];
        this._charToIndexMap = createCharToIndexMap(_charIndex);
        this._forbidIdx = this._searchNodeForChar(0, this.info.forbiddenWordPrefix);
    }

    private _lookUpCharIndex(char: string): number {
        return this._charToIndexMap[char] ?? -1;
    }

    private wordToNodeCharIndexSequence(word: string): number[] {
        return TrieBlob.charactersToCharIndexSequence(this.wordToCharacters(word), (c) => this._lookUpCharIndex(c));
    }

    private letterToNodeCharIndexSequence(letter: string): number[] {
        return TrieBlob.toCharIndexSequence(this._lookUpCharIndex(letter));
    }

    has(word: string): boolean {
        return this._has(0, word);
    }

    private _has(nodeIdx: number, word: string): boolean {
        const NodeMaskChildCharIndex = this.bitMasksInfo.NodeMaskChildCharIndex;
        const NodeChildRefShift = this.bitMasksInfo.NodeChildRefShift;
        const NodeMaskEOW = this.bitMasksInfo.NodeMaskEOW;
        const nodes = this.nodes;
        const charIndexes = this.wordToNodeCharIndexSequence(word);
        const len = charIndexes.length;
        let node = nodes[nodeIdx];
        for (let p = 0; p < len; ++p, node = nodes[nodeIdx]) {
            const letterIdx = charIndexes[p];
            const count = node.length;
            let i = count - 1;
            for (; i > 0; --i) {
                if ((node[i] & NodeMaskChildCharIndex) === letterIdx) {
                    break;
                }
            }
            if (i < 1) return false;
            nodeIdx = node[i] >>> NodeChildRefShift;
            if (!nodeIdx) return false;
        }

        return !!(node[0] & NodeMaskEOW);
    }

    *words(): Iterable<string> {
        interface StackItem {
            nodeIdx: number;
            pos: number;
            word: string;
            accumulator: NumberSequenceByteDecoderAccumulator;
        }
        const NodeMaskChildCharIndex = this.bitMasksInfo.NodeMaskChildCharIndex;
        const NodeChildRefShift = this.bitMasksInfo.NodeChildRefShift;
        const NodeMaskEOW = this.bitMasksInfo.NodeMaskEOW;
        const nodes = this.nodes;
        const accumulator = NumberSequenceByteDecoderAccumulator.create();
        const stack: StackItem[] = [{ nodeIdx: 0, pos: 0, word: '', accumulator }];
        let depth = 0;

        while (depth >= 0) {
            const { nodeIdx, pos, word, accumulator } = stack[depth];
            const node = nodes[nodeIdx];

            if (!pos && node[0] & NodeMaskEOW) {
                yield word;
            }
            if (pos >= node.length - 1) {
                --depth;
                continue;
            }
            const nextPos = ++stack[depth].pos;
            const entry = node[nextPos];
            const charIdx = entry & NodeMaskChildCharIndex;
            const acc = accumulator.clone();
            const letterIdx = acc.decode(charIdx);
            const letter = (letterIdx && this._charIndex[letterIdx]) || '';
            ++depth;
            stack[depth] = {
                nodeIdx: entry >>> NodeChildRefShift,
                pos: 0,
                word: word + letter,
                accumulator: acc,
            };
        }
    }

    toTrieBlob(): TrieBlob {
        const NodeMaskChildCharIndex = this.bitMasksInfo.NodeMaskChildCharIndex;
        const NodeChildRefShift = this.bitMasksInfo.NodeChildRefShift;
        const nodes = this.nodes;
        function calcNodeToIndex(nodes: number[][]): number[] {
            let offset = 0;
            const idx: number[] = Array(nodes.length + 1);
            for (let i = 0; i < nodes.length; ++i) {
                idx[i] = offset;
                offset += nodes[i].length;
            }
            idx[nodes.length] = offset;
            return idx;
        }

        const nodeToIndex = calcNodeToIndex(nodes);
        const nodeElementCount = nodeToIndex[nodeToIndex.length - 1];
        const binNodes = new Uint32Array(nodeElementCount);
        const lenShift = TrieBlob.NodeMaskNumChildrenShift;
        const refShift = TrieBlob.NodeChildRefShift;

        let offset = 0;
        for (let i = 0; i < nodes.length; ++i) {
            const node = nodes[i];
            // assert(offset === nodeToIndex[i]);
            binNodes[offset++] = ((node.length - 1) << lenShift) | node[0];
            for (let j = 1; j < node.length; ++j) {
                const v = node[j];
                const nodeRef = v >>> NodeChildRefShift;
                const charIndex = v & NodeMaskChildCharIndex;
                binNodes[offset++] = (nodeToIndex[nodeRef] << refShift) | charIndex;
            }
        }

        return new TrieBlob(binNodes, this._charIndex, this.info);
    }

    isReadonly(): boolean {
        return this._readonly;
    }

    freeze(): this {
        this._readonly = true;
        return this;
    }

    toJSON() {
        return {
            info: this.info,
            nodes: nodesToJson(this.nodes),
            charIndex: this._charIndex,
        };
    }

    static create(data: FastTrieBlobInternals, options?: PartialTrieInfo) {
        return new FastTrieBlob(data.nodes, data.charIndex, extractInfo(data), options);
    }

    static toITrieNodeRoot(trie: FastTrieBlob): ITrieNodeRoot {
        return new FastTrieBlobIRoot(
            new FastTrieBlobInternals(trie.nodes, trie._charIndex, trie._charToIndexMap, trie.bitMasksInfo),
            0,
            trie.info,
        );
    }

    static NodeMaskEOW = TrieBlob.NodeMaskEOW;
    static NodeChildRefShift = TrieBlob.NodeChildRefShift;
    static NodeMaskChildCharIndex = TrieBlob.NodeMaskChildCharIndex;

    static DefaultBitMaskInfo: FastTrieBlobBitMaskInfo = {
        NodeMaskEOW: FastTrieBlob.NodeMaskEOW,
        NodeMaskChildCharIndex: FastTrieBlob.NodeMaskChildCharIndex,
        NodeChildRefShift: FastTrieBlob.NodeChildRefShift,
    };

    get iTrieRoot(): ITrieNodeRoot {
        return (this._iTrieRoot ??= FastTrieBlob.toITrieNodeRoot(this));
    }

    getRoot(): ITrieNodeRoot {
        return this.iTrieRoot;
    }

    getNode(prefix: string): ITrieNode | undefined {
        return findNode(this.getRoot(), prefix);
    }

    isForbiddenWord(word: string): boolean {
        return !!this._forbidIdx && this._has(this._forbidIdx, word);
    }

    hasForbiddenWords(): boolean {
        return !!this._forbidIdx;
    }

    /** number of nodes */
    get size() {
        return this.nodes.length;
    }

    private _lookupCharIndexNode(nodeIdx: number, charIndex: number): number {
        const NodeMaskChildCharIndex = this.bitMasksInfo.NodeMaskChildCharIndex;
        const NodeChildRefShift = this.bitMasksInfo.NodeChildRefShift;
        const nodes = this.nodes;
        const node = nodes[nodeIdx];
        const letterIdx = charIndex;
        const count = node.length;
        let i = count - 1;
        for (; i > 0; --i) {
            if ((node[i] & NodeMaskChildCharIndex) === letterIdx) {
                return node[i] >>> NodeChildRefShift;
            }
        }
        return 0;
    }

    /** Search from nodeIdx for the node index representing the character. */
    private _searchNodeForChar(nodeIdx: number, char: string): number {
        const charIndexes = this.letterToNodeCharIndexSequence(char);
        let idx = nodeIdx;
        for (let i = 0; i < charIndexes.length; ++i) {
            idx = this._lookupCharIndexNode(idx, charIndexes[i]);
            if (!idx) return 0;
        }
        return idx;
    }

    get charIndex(): readonly string[] {
        return [...this._charIndex];
    }

    static fromTrieBlob(trie: TrieBlob): FastTrieBlob {
        const bitMasksInfo: FastTrieBlobBitMaskInfo = {
            NodeMaskEOW: TrieBlob.NodeMaskEOW,
            NodeMaskChildCharIndex: TrieBlob.NodeMaskChildCharIndex,
            NodeChildRefShift: TrieBlob.NodeChildRefShift,
        };
        const trieNodesBin = TrieBlob.nodesView(trie);
        const nodeOffsets: number[] = [];
        for (
            let offset = 0;
            offset < trieNodesBin.length;
            offset += (trieNodesBin[offset] & TrieBlob.NodeMaskNumChildren) + 1
        ) {
            nodeOffsets.push(offset);
        }
        const offsetToNodeIndex = new Map<number, number>(nodeOffsets.map((offset, i) => [offset, i]));
        const nodes: FastTrieBlobNode[] = Array.from({ length: nodeOffsets.length });
        for (let i = 0; i < nodes.length; ++i) {
            const offset = nodeOffsets[i];
            const n = trieNodesBin[offset];
            const eow = n & TrieBlob.NodeMaskEOW;
            const count = n & TrieBlob.NodeMaskNumChildren;
            // Preallocate the array to the correct size.
            const node = Array.from<number>({ length: count + 1 });
            node[0] = eow;
            nodes[i] = node;
            for (let j = 1; j <= count; ++j) {
                const n = trieNodesBin[offset + j];
                const charIndex = n & TrieBlob.NodeMaskChildCharIndex;
                const nodeIndex = n >>> TrieBlob.NodeChildRefShift;
                const idx = offsetToNodeIndex.get(nodeIndex);
                if (idx === undefined) {
                    throw new Error(`Invalid node index ${nodeIndex}`);
                }
                node[j] = (idx << TrieBlob.NodeChildRefShift) | charIndex;
            }
        }
        return new FastTrieBlob(nodes, trie.charIndex, bitMasksInfo, trie.info);
    }
}

function createCharToIndexMap(charIndex: readonly string[]): CharIndexMap {
    const map: CharIndexMap = Object.create(null);
    for (let i = 0; i < charIndex.length; ++i) {
        const char = charIndex[i];
        map[char.normalize('NFC')] = i;
        map[char.normalize('NFD')] = i;
    }
    return map;
}

interface NodeElement {
    id: number;
    eow: boolean;
    n: number;
    c: { c: number | string; i: number }[];
}

function nodesToJson(nodes: FastTrieBlobNode[]) {
    function nodeElement(node: FastTrieBlobNode, index: number): NodeElement {
        const eow = !!(node[0] & TrieBlob.NodeMaskEOW);
        const children: { c: number | string; i: number }[] = node.slice(1).map((n) => ({
            c: ('00' + (n & TrieBlob.NodeMaskChildCharIndex).toString(16)).slice(-2),
            i: n >>> TrieBlob.NodeChildRefShift,
        }));
        return { id: index, eow, n: node.length, c: children };
    }

    const elements: NodeElement[] = nodes.map((n, i) => nodeElement(n, i));
    return elements;
}
