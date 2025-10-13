import fs from "node:fs";
import path from "node:path";
import { Readable, Writable } from "node:stream";

class FileTailReader extends Readable {
  private fd: number | null = null;
  private position = 0;
  private interval: NodeJS.Timeout | null = null;
  constructor(private readonly filePath: string, private readonly pollMs = 50) {
    super();
  }
  override _construct(callback: (error?: Error | null) => void): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      if (!fs.existsSync(this.filePath)) fs.writeFileSync(this.filePath, "");
      this.fd = fs.openSync(this.filePath, "r");
      this.position = 0;
      this.interval = setInterval(() => this.poll(), this.pollMs);
      callback();
    } catch (err) {
      callback(err as Error);
    }
  }
  private poll() {
    if (this.fd === null) return;
    try {
      const stats = fs.fstatSync(this.fd);
      if (stats.size > this.position) {
        const toRead = stats.size - this.position;
        const buffer = Buffer.alloc(Math.min(toRead, 64 * 1024));
        const n = fs.readSync(this.fd, buffer, 0, buffer.length, this.position);
        this.position += n;
        if (n > 0) {
          const chunk = buffer.subarray(0, n);
          // Push as string to match typical stdio behavior
          this.push(chunk.toString("utf8"));
        }
      }
    } catch (e) {
      // Ignore transient errors during polling
    }
  }
  override _read(): void {
    // No-op: we push from the poller when content grows
  }
  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {}
      this.fd = null;
    }
    callback(error);
  }
}

export const createFileStdIoStreams = (inPath: string, outPath: string): {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
} => {
  // Reader tails the input file; Writer appends to output file.
  const input = new FileTailReader(inPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const output = fs.createWriteStream(outPath, { flags: "a" });
  return { input, output };
};

// For client-side: read server's outPath, write to server's inPath
export const createFileStdIoStreamsForClient = (serverInPath: string, serverOutPath: string): {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
} => {
  const input = new FileTailReader(serverOutPath);
  fs.mkdirSync(path.dirname(serverInPath), { recursive: true });
  const output = fs.createWriteStream(serverInPath, { flags: "a" });
  return { input, output };
};
