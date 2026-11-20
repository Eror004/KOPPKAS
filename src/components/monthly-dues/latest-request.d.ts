export interface LatestRequestGate {
  begin(): number;
  invalidate(): number;
  isCurrent(requestId: number): boolean;
}
export function createLatestRequestGate(): LatestRequestGate;
