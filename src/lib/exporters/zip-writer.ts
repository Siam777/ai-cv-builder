/**
 * Lightweight, zero-dependency pure TypeScript ZIP generator (Store mode).
 * Fully compliant with standard PKZIP / OpenXML specification.
 */

// CRC-32 Table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFileEntry {
  path: string;
  data: Uint8Array | string;
}

export class SimpleZip {
  private files: Array<{ path: string; data: Uint8Array; crc: number; offset: number }> = [];

  addFile(path: string, content: string | Uint8Array) {
    const data = typeof content === "string" ? new TextEncoder().encode(content) : content;
    const crc = crc32(data);
    this.files.push({ path, data, crc, offset: 0 });
  }

  generate(): Uint8Array {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    let currentOffset = 0;

    // 1. Write Local File Headers and Data
    for (const file of this.files) {
      file.offset = currentOffset;
      const pathBytes = encoder.encode(file.path);
      const header = new Uint8Array(30 + pathBytes.length);
      const view = new DataView(header.buffer);

      view.setUint32(0, 0x04034b50, true); // Local header signature
      view.setUint16(4, 20, true); // Version needed (2.0)
      view.setUint16(6, 0x0800, true); // UTF-8 filename flag
      view.setUint16(8, 0, true); // Compression method: 0 (Stored)
      view.setUint16(10, 0x5460, true); // Fixed MS-DOS time (10:35:00)
      view.setUint16(12, 0x5d42, true); // Fixed MS-DOS date (2026-10-02)
      view.setUint32(14, file.crc, true); // CRC-32
      view.setUint32(18, file.data.length, true); // Compressed size
      view.setUint32(22, file.data.length, true); // Uncompressed size
      view.setUint16(26, pathBytes.length, true); // Filename length
      view.setUint16(28, 0, true); // Extra field length

      header.set(pathBytes, 30);
      parts.push(header);
      parts.push(file.data);

      currentOffset += header.length + file.data.length;
    }

    const centralDirectoryStart = currentOffset;
    let centralDirectorySize = 0;

    // 2. Write Central Directory Headers
    for (const file of this.files) {
      const pathBytes = encoder.encode(file.path);
      const cdHeader = new Uint8Array(46 + pathBytes.length);
      const view = new DataView(cdHeader.buffer);

      view.setUint32(0, 0x02014b50, true); // Central directory header signature
      view.setUint16(4, 20, true); // Version made by
      view.setUint16(6, 20, true); // Version needed
      view.setUint16(8, 0x0800, true); // UTF-8 filename flag
      view.setUint16(10, 0, true); // Compression method: 0
      view.setUint16(12, 0x5460, true); // Time
      view.setUint16(14, 0x5d42, true); // Date
      view.setUint32(16, file.crc, true); // CRC-32
      view.setUint32(20, file.data.length, true); // Compressed size
      view.setUint32(24, file.data.length, true); // Uncompressed size
      view.setUint16(28, pathBytes.length, true); // Filename length
      view.setUint16(30, 0, true); // Extra field length
      view.setUint16(32, 0, true); // File comment length
      view.setUint16(34, 0, true); // Disk number start
      view.setUint16(36, 0, true); // Internal attributes
      view.setUint32(38, 0, true); // External attributes
      view.setUint32(42, file.offset, true); // Relative offset of local header

      cdHeader.set(pathBytes, 46);
      parts.push(cdHeader);
      centralDirectorySize += cdHeader.length;
      currentOffset += cdHeader.length;
    }

    // 3. Write End of Central Directory Record (EOCD)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);

    eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
    eocdView.setUint16(4, 0, true); // Number of this disk
    eocdView.setUint16(6, 0, true); // Disk where central directory starts
    eocdView.setUint16(8, this.files.length, true); // Total records on this disk
    eocdView.setUint16(10, this.files.length, true); // Total records
    eocdView.setUint32(12, centralDirectorySize, true); // Size of central directory
    eocdView.setUint32(16, centralDirectoryStart, true); // Offset of start of central directory
    eocdView.setUint16(20, 0, true); // Comment length

    parts.push(eocd);

    // Concatenate all byte chunks
    const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }

    return result;
  }
}
