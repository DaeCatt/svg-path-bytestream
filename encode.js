/**
 * (Nearly) Lossless SVG Path Compression
 */

"use strict";

const fs = require("fs");
const encodePathDef = require("./lib/encode");
const JS_FLOAT_RE = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?([Ee][+-]?[0-9]+)?$/;

let factor = null;
let permissibleError = null;
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

	if (argument.startsWith("--error=")) {
		if (permissibleError !== null) {
			process.stderr.write("Error option already specified.\n");
			process.exit(1);
		}

		tmp = argument.slice("--error=".length);
		if (!JS_FLOAT_RE.test(tmp)) {
			process.stderr.write("Invalid error value.\n");
			process.exit(1);
		}

		permissibleError = parseFloat(tmp);
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
		case "-e":
		case "--error":
			if (permissibleError !== null) {
				process.stderr.write("Error option already specified.\n");
				process.exit(1);
			}

			if (args.length === 0) {
				process.stderr.write("Missing error value.\n");
				process.exit(1);
			}

			tmp = args.shift();
			if (!JS_FLOAT_RE.test(tmp)) {
				process.stderr.write("Invalid error value.\n");
				process.exit(1);
			}

			permissibleError = parseFloat(tmp);
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

			input = fs.createReadStream(argument, "utf-8");
	}
}

if (input === null) {
	process.stderr.write("No input specified.");
	process.exit(1);
}

let pathDef = "";
input.on("data", chunk => {
	pathDef += chunk.toString("utf-8");
});

input.on("end", () => {
	for (const chunk of encodePathDef(pathDef, {
		factor: factor === null ? 1 : factor,
		permissibleError: permissibleError === null ? 0 : permissibleError
	})) {
		process.stdout.write(new Uint8Array(chunk.buffer));
	}
});
