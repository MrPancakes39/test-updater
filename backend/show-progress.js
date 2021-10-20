const Stream = require("stream");

const printf = (...args) => process.stdout.write(...args);
const getPerct = (current, total) => Math.floor((current * 100) / total);

module.exports = async (data) => {
    const {body} = data;

    // Body is null or Body not a stream
	if (body === null || !(body instanceof Stream)) {
		return Buffer.alloc(0);
	}

    const totalBytes = data.headers.get("content-length");

    // Body is stream
	// get ready to actually ready the body
	const accum = [];
	let accumBytes = 0;

	try {
		for await (const chunk of body) {
			if (data.size > 0 && accumBytes + chunk.length > data.size) {
				const error = new Error(`content size at ${data.url} over limit: ${data.size}`, 'max-size');
				body.destroy(error);
				throw error;
			}

			accumBytes += chunk.length;
			accum.push(chunk);
			printf(`\r${getPerct(accumBytes, totalBytes)}% | ${accumBytes} bytes of ${totalBytes} bytes`);
		}
		printf("\n");
	} catch (error) {
		const error_ = error instanceof Error ? error : new Error(`Invalid response body while trying to fetch ${data.url}: ${error.message}`, 'system', error);
		throw error_;
	}
	
	if (body.readableEnded === true || body._readableState.ended === true) {
		try {
			if (accum.every(c => typeof c === 'string')) {
				return Buffer.from(accum.join(''));
			}
			return Buffer.concat(accum, accumBytes);
		} catch (error) {
			throw new Error(`Could not create Buffer from response body for ${data.url}: ${error.message}`, 'system', error);
		}
	} else {
		throw new Error(`Premature close of server response while trying to fetch ${data.url}`);
	}
}