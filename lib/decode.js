"use strict";

const COMMANDS = Array.from("_HVTMLQSAAAA__CZ");
// prettier-ignore
const ARGS = [,1,1,2,2,2,4,4,5,5,5,5,,,6,0];

// prettier-ignore
const MMAP = [
	DataView.prototype.getInt8,
	DataView.prototype.getUint8,
	DataView.prototype.getInt16,
	DataView.prototype.getUint16,
	DataView.prototype.getInt32,
	DataView.prototype.getUint32,
	DataView.prototype.getFloat32,
	DataView.prototype.getFloat64
];
// prettier-ignore
const SMAP = [1,1,2,2,4,4,4,8];

/**
 * Decode buffer of encoded commands.
 * @param {ArrayBuffer} buffer
 * @param {number} byteOffset
 * @param {number} byteLength
 * @param {number} factor
 * @return {Iterable<{type: string, values: number[]}>}
 */
function* decode(
	buffer,
	byteOffset = 0,
	byteLength = buffer.byteLength - byteOffset,
	factor = 1
) {
	const view = new DataView(buffer, byteOffset, byteLength);
	let i = 0;
	while (i < byteLength) {
		const byte = view.getUint8(i++);
		const command = COMMANDS[byte >> 4];
		if (command === "_") throw new Error("Invalid input.");

		const argCount = ARGS[byte >> 4];
		const type = ((byte >> 3) & 1) === 1 ? command.toLowerCase() : command;
		const method = MMAP[byte & 0b111];
		const size = SMAP[byte & 0b111];

		const values = [];
		for (let j = 0; j < argCount; ++j, i += size) {
			values[j] = method.call(view, i, true) / factor;
		}

		if (command === "A") {
			const flags = (byte >> 4) & 0b11;
			values.splice(3, 0, flags >> 1, flags & 1);
		}

		yield { type, values };
	}
}

module.exports = decode;
