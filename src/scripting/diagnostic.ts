export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  message: string;
  severity: DiagnosticSeverity;
  line: number;
  column: number;
  from: number;
  to: number;
}
