import { describe, expect, it } from "vitest";
import { parseNumstat, summarize, Change } from "../core";

describe("parseNumstat", () => {
    it("returns empty array when diff output is blank", () => {
        expect(parseNumstat("")).toEqual([]);
        expect(parseNumstat("\n")).toEqual([]);
    });

    it("parses multiple numstat rows with file paths containing tabs", () => {
        const diff = [
            "10\t2\tsrc/index.ts",
            "-\t-\tREADME.md",
            "3\t4\tsome\tdir/file.ts",
        ].join("\n");

        expect(parseNumstat(diff)).toEqual<Change[]>([
            { file: "src/index.ts", added: 10, deleted: 2 },
            { file: "README.md", added: 0, deleted: 0 },
            { file: "some\tdir/file.ts", added: 3, deleted: 4 },
        ]);
    });
});

describe("summarize", () => {
    it("counts files and total line deltas", () => {
        const changes: Change[] = [
            { file: "a.ts", added: 10, deleted: 2 },
            { file: "b.ts", added: 0, deleted: 5 },
        ];

        expect(summarize(changes)).toEqual({ files: 2, lines: 17 });
    });

    it("handles empty inputs", () => {
        expect(summarize([])).toEqual({ files: 0, lines: 0 });
    });
});
