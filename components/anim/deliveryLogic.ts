export type Mode = "at-most-once" | "at-least-once" | "exactly-once";
export type Fault = "none" | "crash" | "dropAck";
export type Sim = { next: number; deliveries: number; lost: number; redelivered: number; charged: number; note: string };

export const TOTAL = 10;
export const MODES: Mode[] = ["at-most-once", "at-least-once", "exactly-once"];
export const START: Sim = { next: 0, deliveries: 0, lost: 0, redelivered: 0, charged: 0, note: "10 payments are queued. Send one at a time." };

// Pure: advance one message (id = s.next) under a mode and an optional fault.
// crash = consumer dies after processing, before ack (at-most-once acks first, so it dies before processing).
// dropAck = processing and ack-send succeed, but the ack never reaches the broker.
export function deliver(s: Sim, mode: Mode, fault: Fault): Sim {
  const id = s.next + 1;
  const base = { ...s, next: s.next + 1, deliveries: s.deliveries + 1 };
  if (mode === "at-most-once") {
    if (fault === "crash")
      return { ...base, lost: s.lost + 1, note: `#${id}: broker acked on delivery, consumer died before charging. Never retried: lost.` };
    return { ...base, charged: s.charged + 1, note: `#${id}: acked first, then charged once.${fault === "dropAck" ? " The dropped ack changed nothing: no retry." : ""}` };
  }
  if (fault === "none") return { ...base, charged: s.charged + 1, note: `#${id}: charged, acked. Clean.` };
  const why = fault === "crash" ? "consumer died after charging, before ack" : "ack lost on the network";
  const redelivery = { ...base, deliveries: base.deliveries + 1, redelivered: s.redelivered + 1 };
  if (mode === "at-least-once")
    return { ...redelivery, charged: s.charged + 2, note: `#${id}: ${why}. Broker redelivered, consumer charged again: double charge.` };
  return { ...redelivery, charged: s.charged + 1, note: `#${id}: ${why}. Redelivered, but the consumer saw id ${id} already and skipped the charge.` };
}

