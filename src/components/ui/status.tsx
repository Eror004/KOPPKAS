import type { ReactNode } from "react";

type StatusProps = { title: string; children?: ReactNode; action?: ReactNode };
export function Status({ kind, title, children, action }: StatusProps & { kind: "loading" | "empty" | "error" | "success" }) {
  return <section className={`ui-status ui-status--${kind}`} role={kind === "error" ? "alert" : "status"}>
    {kind === "loading" && <span className="ui-spinner" aria-hidden="true" />}
    <strong>{title}</strong>{children && <div>{children}</div>}{action}
  </section>;
}
