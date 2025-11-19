export interface Change {
    file: string;
    added: number;
    deleted: number;
}

const toInt = (value: string): number => {
    if (value === "-") return 0;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Parse the output of `git diff --numstat` into Change records.
 */
export function parseNumstat(diffOutput: string): Change[] {
    if (!diffOutput.trim()) return [];

    return diffOutput
        .split("\n")
        .filter(Boolean)
        .map((line) => {
            const [added, deleted, ...pathParts] = line.split("\t");
            return {
                file: pathParts.join("\t"),
                added: toInt(added),
                deleted: toInt(deleted),
            };
        });
}

export function summarize(changes: Change[]): { files: number; lines: number } {
    const files = changes.length;
    const lines = changes.reduce((acc, change) => acc + change.added + change.deleted, 0);
    return { files, lines };
}
