/**
 * (Nearly) Lossless SVG Compression
 */

"use strict";

/**
 * @typedef {Uint8Array|Uint16Array|Uint32Array|Int8Array|Int16Array|Int32Array|Float32Array|Float64Array} TypedArray
 */

// prettier-ignore
const RAW_ARG_COUNTS = {Z:0,H:1,V:1,T:2,M:2,L:2,Q:4,S:4,C:6,A:7};

const COMMAND_MASK = {
	H: 0b0001 << 4,
	V: 0b0010 << 4,
	T: 0b0011 << 4,
	M: 0b0100 << 4,
	L: 0b0101 << 4,
	Q: 0b0110 << 4,
	S: 0b0111 << 4,
	A00: 0b1000 << 4,
	A01: 0b1001 << 4,
	A10: 0b1010 << 4,
	A11: 0b1011 << 4,
	C: 0b1110 << 4,
	Z: 0b1111 << 4
};

const TYPE_MASK = {
	int8: 0b000,
	uint8: 0b001,
	int16: 0b010,
	uint16: 0b011,
	int32: 0b100,
	uint32: 0b101,
	float32: 0b110,
	float64: 0b111
};

const COMMANDS = new Set(Array.from("MmLlHhVvCcQqSsTtAaZz"));
const FLOAT_RE = /[MmLlHhVvCcQqSsTtAaZz]|[-+]?[0-9]*\.?[0-9]+(?:[Ee][-+]?[0-9]+)?/g;

/**
 * @param {string} string
 * @return {Iterable<{type: "float"|"command", value: string}>}
 */
function* tokenizePath(string) {
	let match;
	while ((match = FLOAT_RE.exec(string)) !== null) {
		if (COMMANDS.has(match[0])) {
			yield { type: "command", value: match[0] };
			continue;
		}

		yield { type: "float", value: match[0] };
	}
}

/**
 * @param {Iterable<{type: "float"|"command", value: string}>} tokens
 * @return {Iterable<{type: string, values: number[]}>}
 */
function* parseGroupedCommands(tokens) {
	/**
	 * @type {{type: string, values: number[]}}
	 */
	let command = null;
	for (const { type, value } of tokens) {
		if (type === "command") {
			if (command !== null) yield command;
			command = { type: value, values: [] };
			continue;
		}

		if (command === null) throw new Error("Missing first command.");
		const float = parseFloat(value);

		if (Number.isNaN(float))
			throw new Error(`Couldn't parse number "${value}"`);

		command.values.push(float);
	}

	if (command !== null) yield command;
}

/**
 * @param {Iterable<{type: string, values: number[]}>} commands
 * @return {Iterable<{type: string, values: number[]}>}
 */
function* ungroupCommands(commands) {
	for (const { type, values } of commands) {
		const argumentCount = RAW_ARG_COUNTS[type.toUpperCase()];
		if (argumentCount === 0) {
			if (values.length > 0)
				throw new Error(`Command "${type}" must not have arguments.`);

			yield { type, values: [] };
			continue;
		}

		if (values.length === 0)
			throw new Error(
				`Command "${type}" requires a minimum of ${argumentCount} arguments.`
			);

		if (values.length % argumentCount !== 0)
			throw new Error(
				`Command "${type}" requires a multiple of ${argumentCount} arguments.`
			);

		for (let i = 0; i < values.length; i += argumentCount)
			yield { type, values: values.slice(i, i + argumentCount) };
	}
}

/**
 * @param {Iterable<{type: string, values: number[]}>} commands
 * @return {Iterable<{type: string, values: number[]}>}
 */
function* expandACommands(commands) {
	for (const command of commands) {
		if (command.type !== "A" && command.type !== "a") {
			yield command;
			continue;
		}

		const [largeArcFlag, sweepFlag] = command.values.splice(3, 2);
		if (largeArcFlag !== 0 && largeArcFlag !== 1)
			throw new Error(
				`Invalid value for large-arc-flag: "${largeArcFlag}"`
			);

		if (sweepFlag !== 0 && sweepFlag !== 1)
			throw new Error(`Invalid value for sweep-flag: "${sweepFlag}"`);

		command.type += largeArcFlag.toString(2) + sweepFlag.toString(2);
		yield command;
	}
}

const numberArrayEquals = (a, b, epsilon = 0) =>
	a.length === b.length &&
	a.every((num, i) =>
		epsilon === 0 ? num === b[i] : Math.abs(num - b[i]) < epsilon
	);

const IS_UINT8 = int => int >= 0 && int < 256;
const IS_UINT16 = int => int >= 0 && int < 65536;
const IS_UINT32 = int => int >= 0 && int < 4294967296;

const IS_INT8 = int => int >= -128 && int < 128;
const IS_INT16 = int => int >= -32768 && int < 32768;
const IS_INT32 = int => int >= -2147483648 && int < 2147483648;

/**
 * @param {Object} command
 * @param {string} command.type
 * @param {number[]} command.values
 * @param {Object} options
 * @param {number=} options.factor
 * @param {number=} options.permissibleError
 * @return {Iterable<TypedArray>}
 */
function* encodeCommand(
	{ type, values },
	{ factor = 1, permissibleError = 0 } = {}
) {
	let commandMask = COMMAND_MASK[type.toUpperCase()];
	if (type === type.toLowerCase()) commandMask |= 0b1000;

	if (values.length === 0) return yield new Uint8Array([commandMask]);

	const error = permissibleError * factor;

	const floats = factor !== 1 ? values.map(float => float * factor) : values;
	const ints = floats.map(Math.round);

	if (numberArrayEquals(floats, ints, error)) {
		if (ints.every(IS_INT8)) {
			yield new Uint8Array([commandMask | TYPE_MASK.int8]);
			return yield new Int8Array(ints);
		}

		if (ints.every(IS_INT16)) {
			yield new Uint8Array([commandMask | TYPE_MASK.int16]);
			return yield new Int16Array(ints);
		}

		if (ints.every(IS_INT32)) {
			yield new Uint8Array([commandMask | TYPE_MASK.int32]);
			return yield new Int32Array(ints);
		}

		if (ints.every(IS_UINT8)) {
			yield new Uint8Array([commandMask | TYPE_MASK.uint8]);
			return yield new Uint8Array(ints);
		}

		if (ints.every(IS_UINT16)) {
			yield new Uint8Array([commandMask | TYPE_MASK.uint16]);
			return yield new Uint16Array(ints);
		}

		if (ints.every(IS_UINT32)) {
			yield new Uint8Array([commandMask | TYPE_MASK.uint32]);
			return yield new Uint32Array(ints);
		}
	}

	const float32 = new Float32Array(floats);
	if (numberArrayEquals(floats, float32, error)) {
		yield new Uint8Array([commandMask | TYPE_MASK.float32]);
		return yield float32;
	}

	yield new Uint8Array([commandMask | TYPE_MASK.float64]);
	return yield new Float64Array(floats);
}

/**
 * Encode path def string to Iterable of TypedArrays.
 * @param {string} string
 * @param {Object} options
 * @param {number=} options.factor
 * @param {number=} options.permissibleError
 * @return {Iterable<TypedArray>}
 */
function* encode(string, { factor = 1, permissibleError = 0 } = {}) {
	const tokens = tokenizePath(string);
	const groupedCommands = parseGroupedCommands(tokens);
	const ungroupedCommands = ungroupCommands(groupedCommands);
	const expandedCommands = expandACommands(ungroupedCommands);

	for (const command of expandedCommands)
		yield* encodeCommand(command, { factor, permissibleError });
}

module.exports = encode;
