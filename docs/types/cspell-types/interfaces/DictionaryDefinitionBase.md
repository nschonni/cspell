[@cspell/cspell-types](../README.md) / [Exports](../modules.md) / DictionaryDefinitionBase

# Interface: DictionaryDefinitionBase

## Hierarchy

- **`DictionaryDefinitionBase`**

  ↳ [`DictionaryDefinitionPreferred`](DictionaryDefinitionPreferred.md)

  ↳ [`DictionaryDefinitionAlternate`](DictionaryDefinitionAlternate.md)

## Table of contents

### Properties

- [description](DictionaryDefinitionBase.md#description)
- [name](DictionaryDefinitionBase.md#name)
- [noSuggest](DictionaryDefinitionBase.md#nosuggest)
- [repMap](DictionaryDefinitionBase.md#repmap)
- [type](DictionaryDefinitionBase.md#type)
- [useCompounds](DictionaryDefinitionBase.md#usecompounds)

## Properties

### description

• `Optional` **description**: `string`

Optional description.

#### Defined in

[CSpellSettingsDef.ts:443](https://github.com/streetsidesoftware/cspell/blob/ffde5ac/packages/cspell-types/src/CSpellSettingsDef.ts#L443)

___

### name

• **name**: `string`

This is the name of a dictionary.

Name Format:
- Must contain at least 1 number or letter.
- Spaces are allowed.
- Leading and trailing space will be removed.
- Names ARE case-sensitive.
- Must not contain `*`, `!`, `;`, `,`, `{`, `}`, `[`, `]`, `~`.

#### Defined in

[CSpellSettingsDef.ts:441](https://github.com/streetsidesoftware/cspell/blob/ffde5ac/packages/cspell-types/src/CSpellSettingsDef.ts#L441)

___

### noSuggest

• `Optional` **noSuggest**: `boolean`

Indicate that suggestions should not come from this dictionary.
Words in this dictionary are considered correct, but will not be
used when making spell correction suggestions.

Note: if a word is suggested by another dictionary, but found in
this dictionary, it will be removed from the set of
possible suggestions.

#### Defined in

[CSpellSettingsDef.ts:457](https://github.com/streetsidesoftware/cspell/blob/ffde5ac/packages/cspell-types/src/CSpellSettingsDef.ts#L457)

___

### repMap

• `Optional` **repMap**: [`ReplaceMap`](../modules.md#replacemap)

Replacement pairs.

#### Defined in

[CSpellSettingsDef.ts:445](https://github.com/streetsidesoftware/cspell/blob/ffde5ac/packages/cspell-types/src/CSpellSettingsDef.ts#L445)

___

### type

• `Optional` **type**: [`DictionaryFileTypes`](../modules.md#dictionaryfiletypes)

Type of file:
S - single word per line,
W - each line can contain one or more words separated by space,
C - each line is treated like code (Camel Case is allowed).
Default is S.
C is the slowest to load due to the need to split each line based upon code splitting rules.

**`default`** "S"

#### Defined in

[CSpellSettingsDef.ts:467](https://github.com/streetsidesoftware/cspell/blob/ffde5ac/packages/cspell-types/src/CSpellSettingsDef.ts#L467)

___

### useCompounds

• `Optional` **useCompounds**: `boolean`

Use Compounds.

#### Defined in

[CSpellSettingsDef.ts:447](https://github.com/streetsidesoftware/cspell/blob/ffde5ac/packages/cspell-types/src/CSpellSettingsDef.ts#L447)