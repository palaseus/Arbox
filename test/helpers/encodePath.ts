export function encodePath(path: string[], fees: number[]): string {
  if (path.length !== fees.length + 1) throw new Error("Invalid path/fees length");
  let encoded = "0x";
  for (let i = 0; i < fees.length; i++) {
    encoded += path[i].slice(2).toLowerCase();
    encoded += fees[i].toString(16).padStart(6, "0"); // 3 bytes = 6 hex chars
  }
  encoded += path[path.length - 1].slice(2).toLowerCase();
  return encoded;
} 