#!/usr/bin/env node
import { execSync } from "node:child_process";
import inquirer from "inquirer";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

interface Change {
    file: string;
    added: number;
    deleted: number;
}

function runGit(cmd: string): string {
    return execSync(cmd, { encoding: "utf8" }).trim();
}

function getChanges(): Change[] {
    // Includes staged + unstaged changes vs HEAD
    const diff = runGit("git diff --numstat");
    if (!diff) return [];

    return diff
        .split("\n")
        .filter(Boolean)
        .map((line) => {
            const [added, deleted, ...pathParts] = line.split("\t");
            const file = pathParts.join("\t");
            const toInt = (x: string) => (x === "-" ? 0 : parseInt(x, 10) || 0);
            return {
                file,
                added: toInt(added),
                deleted: toInt(deleted),
            };
        });
}

function summarize(changes: Change[]) {
    const files = changes.length;
    const lines = changes.reduce((acc, c) => acc + c.added + c.deleted, 0);
    return { files, lines };
}

async function interactiveBucketing(
    changes: Change[],
    maxFilesPerCommit: number,
    maxLinesPerCommit: number | null
) {
    let bucketIndex = 1;

    while (true) {
        changes = getChanges(); // refresh in case user did anything manually
        if (changes.length === 0) {
            console.log("✅ No more changes to commit. All clean.");
            return;
        }

        const { files: totalFiles, lines: totalLines } = summarize(changes);
        console.log(
            `\nRemaining changes: ${totalFiles} files, ${totalLines} lines`
        );

        const maxSelectable = Math.min(maxFilesPerCommit, totalFiles);

        const { selectedFiles } = await inquirer.prompt<{
            selectedFiles: string[];
        }>([
            {
                type: "checkbox",
                name: "selectedFiles",
                message: `Bucket #${bucketIndex}: Select up to ${maxSelectable} files to include in this commit`,
                choices: changes.map((c) => ({
                    name: `${c.file} (+${c.added} -${c.deleted})`,
                    value: c.file,
                })),
                validate: (input: string[]) => {
                    if (input.length === 0) return "Select at least one file.";
                    if (input.length > maxSelectable)
                        return `You can select at most ${maxSelectable} files.`;
                    return true;
                },
            },
        ]);

        const bucketChanges = changes.filter((c) =>
            selectedFiles.includes(c.file)
        );
        const { files, lines } = summarize(bucketChanges);

        if (maxLinesPerCommit !== null && lines > maxLinesPerCommit) {
            console.log(
                `🔴 This bucket has ${lines} line changes, which exceeds maxLinesPerCommit=${maxLinesPerCommit}. Please select fewer files.`
            );
            continue;
        }

        // Stage selected files
        console.log("➕ Staging selected files...");
        runGit(`git add ${selectedFiles.map((f) => `"${f}"`).join(" ")}`);

        const { commitMessage } = await inquirer.prompt<{
            commitMessage: string;
        }>([
            {
                type: "input",
                name: "commitMessage",
                message: `Commit message for bucket #${bucketIndex}:`,
                validate: (input: string) =>
                    input.trim().length === 0 ? "Commit message cannot be empty." : true,
            },
        ]);

        console.log(
            `🔹 Committing bucket #${bucketIndex} (${files} files, ${lines} lines)...`
        );
        try {
            runGit(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
        } catch (e) {
            console.error("🔴 git commit failed. Aborting bucketing.", e);
            process.exit(1);
        }

        const { more } = await inquirer.prompt<{ more: boolean }>([
            {
                type: "confirm",
                name: "more",
                message: "Do you want to create another bucket for remaining changes?",
                default: true,
            },
        ]);

        bucketIndex += 1;

        if (!more) {
            console.log("👋 Done. You can handle remaining changes manually.");
            return;
        }
    }
}

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option("maxFiles", {
            type: "number",
            default: 10,
            describe: "Max number of files allowed per commit",
        })
        .option("maxLines", {
            type: "number",
            default: 1000,
            describe:
                "Max number of changed lines (added+deleted) allowed per commit. Use 0 to disable line limit.",
        })
        .option("interactive", {
            type: "boolean",
            default: false,
            describe:
                "If limits are exceeded, start interactive bucketing instead of just failing.",
        })
        .option("quiet", {
            type: "boolean",
            default: false,
            describe: "Print less info (for pre-commit hook use).",
        })
        .help()
        .parse();

    const maxFiles = argv.maxFiles!;
    const maxLines = argv.maxLines! || null;
    const interactive = argv.interactive!;
    const quiet = argv.quiet!;

    // Sanity checks
    try {
        runGit("git rev-parse --is-inside-work-tree");
    } catch {
        console.error("🔴 Not inside a Git repository.");
        process.exit(1);
    }

    const changes = getChanges();
    const { files, lines } = summarize(changes);

    if (!quiet) {
        console.log(
            `📊 Current diff: ${files} files changed, ${lines} lines (+/-) vs HEAD.`
        );
        console.log(
            `🔧 Limits: maxFiles=${maxFiles}${maxLines !== null ? `, maxLines=${maxLines}` : ""
            }`
        );
    }

    const filesExceeded = files > maxFiles;
    const linesExceeded = maxLines !== null && lines > maxLines;

    if (!filesExceeded && !linesExceeded) {
        if (!quiet) console.log("✅ Within limits – good to commit.");
        process.exit(0);
    }

    console.log(
        `🚨 Commit bloat warning: ${filesExceeded ? `${files} files (limit ${maxFiles}) ` : ""
            }${linesExceeded ? `${lines} lines (limit ${maxLines})` : ""}`.trim()
    );

    if (!interactive) {
        console.error(
            "🔴 Limits exceeded. Reduce bloat or run with --interactive to bucket commits."
        );
        process.exit(1);
    }

    await interactiveBucketing(changes, maxFiles, maxLines);
}

main().catch((err) => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
