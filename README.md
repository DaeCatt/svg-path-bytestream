# (Nearly) Lossless SVG Path Byte Streams

Converts textual SVG path commands into a byte stream. Numbers are digitized as
integers (int8, uint8, int16, uint16, int32, uint32), floats (float32), or
doubles (float64). As such accuracy may be lost in a roundtrip.

The command byte stream is generally shorter than the textual representation of
SVG commands, but has a few major failure cases. SVG paths are usually minimized
to a specific decimal precision, eg: `M.2.4h.5v.3H.2z`.

This achieves great reductions in the text format (2 bytes per number), but
requires expensive floats (at minimum float32 = 4 bytes per number) in the byte
stream format.

A way to counteract this effect is to multiply all numbers by 10 for 1 decimal
digit precision, 100 for 2 decimal digit precision, etc. In the above case a
scale factor of 10 would allow the byte stream to represent each digit in a
dense integer representation (eg uint8 = 1 byte per number). This specification
does not include a way to represent such scale factors, so that information
would have to be provided out of band.

## Usage of Included Node-Based Tools

Encoder:

```
node encode.js [OPTIONS] PATH
Outputs to stdout.

Options:
	-f n,          Factor to multiply every number
	--factor n,    in the input string path by.
	--factor=n

	-e n,          Permissible error. Eg. a value
	--error n,     of 0.5 would let the encoder
	--error=n      round to nearest half.

	-              Use stdin as input.
```

Decoder:

```
node decode.js [OPTIONS] PATH
Outputs to stdout.

Options:
	-f n,          Factor to divide every number
	--factor n,    in the input byte stream by.
	--factor=n

	-              Use stdin as input.
```

SVGs are often "optimized" to 3 decimals of precision, as such setting a factor
of `1000` (= 1e3) often provides significant improvements in output size without
losing any accuracy.

Roundtrip:

```
node encode.js -f 1e3 pathd.txt >pathd.bin && node decode.js -f 1e3 pathd.bin
```

## Spec

```
This format encodes SVG path commands into a binary document. No header format
is specified, so the data stream may have to be wrapped. Each command is encoded
into a command byte and N arguments.

The command byte specifies the SVG command used, whether it's using
relative coordinates, and how its arguments are encoded.

The argument encodings are always big-endian, and two's complement in the case
of signed integers.

The command byte format is:

  0   1   2   3   4   5   6   7
+---+---+---+---+---+---+---+---+
|    Command    | R | Encoding  |
+---+---+---+---+---+---+---+---+

Command: 4 bits

	SVG path command. The command also determines the amount of arguments that
	follow this command byte. The byte length of the arguments is determined by
	multiplying the argument count with the byte size of the specified encoding.
	+-------+---------+-----------+-----------------------------+
	| Value | Command | Arguments | Description                 |
	+-------+---------+-----------+-----------------------------+
	|  0000 |    -    |    N/A    | RESERVED                    |
	|  0001 |    H    |         1 | Horizontal line             |
	|  0010 |    V    |         1 | Vertical line               |
	|  0011 |    T    |         2 | Draw smooth quadratic curve |
	|  0100 |    M    |         2 | Move to                     |
	|  0101 |    L    |         2 | Line to                     |
	|  0110 |    Q    |         4 | Quadratic curve             |
	|  0111 |    S    |         4 | Smooth cubic bezier         |
	|  1000 |    A*   |         5 | Arc                         |
	|  1001 |    A*   |         5 | Arc With sweep flag set     |
	|  1010 |    A*   |         5 | Arc With large arc flag set |
	|  1011 |    A*   |         5 | Arc With both flags set     |
	|  1101 |    -    |    N/A    | UNUSED                      |
	|  1100 |    -    |    N/A    | UNUSED                      |
	|  1110 |    C    |         6 | Cubic bezier                |
	|  1111 |    Z**  |         0 | Close path                  |
	+-------+---------+-----------+-----------------------------+

	* The A (Arc) command which normally takes 7 arguments, in which 2 are
	binary flags, has been separated into 4 different commands representing
	each flag pattern. Their values were also chosen such that the last 2 bits
	represent the value of the flags.

	** The Z (Close path) command takes 0 arguments and as such can discard the
	value of Encoding. However for full SVG support Z still respects the
	relative flag.

R: 1 bit

	Relative coordinates flag. Equivalent to to the usage of lowercase
	characters in SVG path commands. Eg. "H" becomes "h".
		0 - false
		1 - true

Encoding: 3 bits

	Encoding used to represent the arguments to this command.
	+-------+----------+--------------+
	| Value | Encoding | Bytes/Number |
	+-------+----------+--------------+
	|  000  |     int8 |            1 |
	|  001  |    uint8 |            1 |
	|  010  |    int16 |            2 |
	|  011  |   uint16 |            2 |
	|  100  |    int32 |            4 |
	|  101  |   uint32 |            4 |
	|  110  |  float32 |            4 |
	|  111  |  float64 |            8 |
	+-------+----------+--------------+
```
