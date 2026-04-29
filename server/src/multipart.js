const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

function parseContentType(header) {
  const contentType = header || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
  if (!boundaryMatch) {
    return null;
  }
  return boundaryMatch[1] || boundaryMatch[2];
}

function parseMultipart(buffer, boundary) {
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const endBuf = Buffer.from(`--${boundary}--`);
  const headerSep = Buffer.from('\r\n\r\n');

  // Find the first boundary
  let pos = bufferIndexOf(buffer, boundaryBuf, 0);
  if (pos === -1) {
    return null;
  }

  pos += boundaryBuf.length;

  // Skip \r\n after boundary
  if (buffer[pos] === 0x0d && buffer[pos + 1] === 0x0a) {
    pos += 2;
  }

  // Find header/body separator
  const headerEnd = bufferIndexOf(buffer, headerSep, pos);
  if (headerEnd === -1) {
    return null;
  }

  const headerBlock = buffer.slice(pos, headerEnd).toString('utf8');
  const bodyStart = headerEnd + 4;

  // Find the next boundary (end of file data)
  const nextBoundary = bufferIndexOf(buffer, boundaryBuf, bodyStart);
  if (nextBoundary === -1) {
    return null;
  }

  // File data ends with \r\n before boundary
  let bodyEnd = nextBoundary;
  if (bodyEnd >= 2 && buffer[bodyEnd - 2] === 0x0d && buffer[bodyEnd - 1] === 0x0a) {
    bodyEnd -= 2;
  }

  const fileBuffer = buffer.slice(bodyStart, bodyEnd);

  // Parse headers
  const filenameMatch = headerBlock.match(/filename="([^"]+)"/i);
  const nameMatch = headerBlock.match(/name="([^"]+)"/i);
  const ctMatch = headerBlock.match(/Content-Type:\s*(.+)/i);

  return {
    fieldName: nameMatch ? nameMatch[1] : 'file',
    originalName: filenameMatch ? filenameMatch[1] : 'upload',
    mimeType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
    buffer: fileBuffer,
    size: fileBuffer.length,
  };
}

function bufferIndexOf(buf, search, start) {
  for (let i = start; i <= buf.length - search.length; i++) {
    let found = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      return i;
    }
  }
  return -1;
}

function readMultipartBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;

    request.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_FILE_BYTES) {
        reject(new Error('文件过大，最大允许 5MB'));
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    request.on('error', reject);
  });
}

module.exports = {
  parseContentType,
  parseMultipart,
  readMultipartBody,
  MAX_FILE_BYTES,
};
