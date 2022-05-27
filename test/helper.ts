import path from 'path';
import { asString } from '../src/utils/asString';

export function helper_writeFile(fs: any, file: string, content: string | Buffer): void {
  fs.mkdirpSync(path.dirname(file));
  fs.writeFileSync(file, asString(content));
}

export function helper_removeFile(fs: any, file: string): void {
  fs.unlinkSync(file);
}

export function helper_touchFile(fs: any, file: string): void {
  const time = Date.now();
  fs.utimesSync(file, time, time);
}
