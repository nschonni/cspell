[@cspell/cspell-types](../README.md) / [Exports](../modules.md) / EditCosts

# Interface: EditCosts

## Table of contents

### Properties

- [accentCosts](EditCosts.md#accentcosts)
- [baseCost](EditCosts.md#basecost)
- [capsCosts](EditCosts.md#capscosts)
- [firstLetterPenalty](EditCosts.md#firstletterpenalty)
- [nonAlphabetCosts](EditCosts.md#nonalphabetcosts)

## Properties

### accentCosts

• `Optional` **accentCosts**: `number`

The cost to add / remove an accent
This should be very cheap, it helps with fixing accent issues.

**`default`** 1

#### Defined in

[DictionaryInformation.ts:286](https://github.com/streetsidesoftware/cspell/blob/b33453b/packages/cspell-types/src/DictionaryInformation.ts#L286)

___

### baseCost

• `Optional` **baseCost**: `number`

This is the base cost for making an edit.

**`default`** 100

#### Defined in

[DictionaryInformation.ts:259](https://github.com/streetsidesoftware/cspell/blob/b33453b/packages/cspell-types/src/DictionaryInformation.ts#L259)

___

### capsCosts

• `Optional` **capsCosts**: `number`

The cost to change capitalization.
This should be very cheap, it helps with fixing capitalization issues.

**`default`** 1

#### Defined in

[DictionaryInformation.ts:279](https://github.com/streetsidesoftware/cspell/blob/b33453b/packages/cspell-types/src/DictionaryInformation.ts#L279)

___

### firstLetterPenalty

• `Optional` **firstLetterPenalty**: `number`

The extra cost incurred for changing the first letter of a word.
This value should be less than `100 - baseCost`.

**`default`** 4

#### Defined in

[DictionaryInformation.ts:272](https://github.com/streetsidesoftware/cspell/blob/b33453b/packages/cspell-types/src/DictionaryInformation.ts#L272)

___

### nonAlphabetCosts

• `Optional` **nonAlphabetCosts**: `number`

This is the cost for characters not in the alphabet.

**`default`** 110

#### Defined in

[DictionaryInformation.ts:265](https://github.com/streetsidesoftware/cspell/blob/b33453b/packages/cspell-types/src/DictionaryInformation.ts#L265)