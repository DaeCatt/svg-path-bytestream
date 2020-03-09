/**
 * Lossless SVG Path Decompression
 */

"use strict";

const fs = require("fs");
const decode = require("./lib/decode");
const JS_FLOAT_RE = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?([Ee][+-]?[0-9]+)?$/;

let factor = null;
let input = null;

const args = process.argv.slice(2);
while (args.length > 0) {
	let tmp;
	const argument = args.shift();
	if (argument.startsWith("--factor=")) {
		if (factor !== null) {
			process.stderr.write("Factor option already specified.\n");
			process.exit(1);
		}

		tmp = argument.slice("--factor=".length);
		if (!JS_FLOAT_RE.test(tmp)) {
			process.stderr.write("Invalid factor value.\n");
			process.exit(1);
		}

		factor = parseFloat(tmp);
		continue;
	}

	switch (argument) {
		case "-f":
		case "--factor":
			if (factor !== null) {
				process.stderr.write("Factor option already specified.\n");
				process.exit(1);
			}

			if (args.length === 0) {
				process.stderr.write("Missing factor value.\n");
				process.exit(1);
			}

			tmp = args.shift();
			if (!JS_FLOAT_RE.test(tmp)) {
				process.stderr.write("Invalid factor value.\n");
				process.exit(1);
			}

			factor = parseFloat(tmp);
			break;
		case "-":
			if (input !== null) {
				process.stderr.write("Input already specified.");
				process.exit(1);
			}

			input = process.stdin;
			break;
		default:
			if (input !== null) {
				process.stderr.write("Input already specified. ???");
				process.exit(1);
			}

			input = fs.createReadStream(argument);
	}
}

if (input === null) {
	process.stderr.write("No input specified.");
	process.exit(1);
}

let inputData = Buffer.alloc(0);
input.on("data", chunk => {
	inputData = Buffer.concat([inputData, chunk]);
});

input.on("end", () => {
	for (const { type, values } of decode(
		inputData.buffer,
		inputData.byteOffset,
		inputData.byteLength,
		factor === null ? 1 : factor
	)) {
		process.stdout.write(type + values.join(" "));
	}

	process.stdout.write("\n");
});
