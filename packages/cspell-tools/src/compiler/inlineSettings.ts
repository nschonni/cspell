export interface InlineSettings {
    split?: boolean;
    keepCase?: boolean;
}

const allowedSettings = ['split', 'no-split', 'keep-case', 'no-keep-case'];

export function extractInlineSettings(line: string): InlineSettings | undefined {
    const m = line.match(/cspell-tools:(.*)/);
    if (!m) return undefined;

    const flags = m[1].split(/\s+/g).filter((a) => !!a);

    const settings: InlineSettings = {};

    for (const flag of flags) {
        switch (flag) {
            case 'split':
                settings.split = true;
                break;
            case 'no-split':
                settings.split = false;
                break;
            case 'keep-case':
                settings.keepCase = true;
                break;
            case 'no-keep-case':
                settings.keepCase = false;
                break;
            default:
                throw new Error(`Unknown inline setting: "${flag}" allowed values are ${allowedSettings.join(', ')}`);
        }
    }
    return settings;
}
