import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { interpret } from "xstate";
import { webSocketMachine } from "../machines/webSocketMachine";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  simulateError() {
    this.onerror?.();
  }
}

let mockInstances: MockWebSocket[] = [];

vi.stubGlobal(
  "WebSocket",
  new Proxy(MockWebSocket, {
    construct(target) {
      const instance = new target();
      mockInstances.push(instance);
      return instance;
    },
  })
);

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("webSocketMachine", () => {
  beforeEach(() => {
    mockInstances = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should start in idle state", () => {
    const service = interpret(webSocketMachine).start();
    expect(service.state.matches("idle")).toBe(true);
    service.stop();
  });

  it("should transition to active.connecting on CONNECT", () => {
    const service = interpret(webSocketMachine).start();
    service.send({ type: "CONNECT", url: "ws://localhost:3001/ws" });
    expect(service.state.matches({ active: "connecting" })).toBe(true);
    expect(service.state.context.url).toBe("ws://localhost:3001/ws");
    service.stop();
  });

  it("should transition to active.connected when WebSocket opens", async () => {
    const service = interpret(webSocketMachine).start();
    service.send({ type: "CONNECT", url: "ws://localhost:3001/ws" });

    await delay(50);
    expect(mockInstances.length).toBe(1);
    mockInstances[0].simulateOpen();

    await delay(50);
    expect(service.state.matches({ active: "connected" })).toBe(true);
    service.stop();
  });

  it("should set hasNewNotifications on NOTIFICATION_CREATED message", async () => {
    const service = interpret(webSocketMachine).start();
    service.send({ type: "CONNECT", url: "ws://localhost:3001/ws" });

    await delay(50);
    mockInstances[0].simulateOpen();

    await delay(50);
    expect(service.state.matches({ active: "connected" })).toBe(true);
    mockInstances[0].simulateMessage({ type: "NOTIFICATION_CREATED" });

    await delay(50);
    expect(service.state.context.hasNewNotifications).toBe(true);
    service.stop();
  });

  it("should clear hasNewNotifications on CLEAR_NEW_NOTIFICATIONS", async () => {
    const service = interpret(webSocketMachine).start();
    service.send({ type: "CONNECT", url: "ws://localhost:3001/ws" });

    await delay(50);
    mockInstances[0].simulateOpen();

    await delay(50);
    mockInstances[0].simulateMessage({ type: "NOTIFICATION_CREATED" });

    await delay(50);
    expect(service.state.context.hasNewNotifications).toBe(true);
    service.send({ type: "CLEAR_NEW_NOTIFICATIONS" });
    expect(service.state.context.hasNewNotifications).toBe(false);
    service.stop();
  });

  it("should transition to disconnected on WebSocket close", async () => {
    const service = interpret(webSocketMachine).start();
    service.send({ type: "CONNECT", url: "ws://localhost:3001/ws" });

    await delay(50);
    mockInstances[0].simulateOpen();

    await delay(50);
    expect(service.state.matches({ active: "connected" })).toBe(true);
    mockInstances[0].simulateClose();

    await delay(50);
    expect(service.state.matches("disconnected")).toBe(true);
    service.stop();
  });

  it("should auto-reconnect after 3s in disconnected state", async () => {
    const service = interpret(webSocketMachine).start();
    service.send({ type: "CONNECT", url: "ws://localhost:3001/ws" });

    await delay(50);
    mockInstances[0].simulateClose();

    await delay(50);
    expect(service.state.matches("disconnected")).toBe(true);

    await delay(3100);
    expect(service.state.matches({ active: "connecting" })).toBe(true);
    service.stop();
  }, 10000);

  it("should clear hasNewNotifications in disconnected state", async () => {
    const service = interpret(webSocketMachine).start();
    service.send({ type: "CONNECT", url: "ws://localhost:3001/ws" });

    await delay(50);
    mockInstances[0].simulateOpen();

    await delay(50);
    mockInstances[0].simulateMessage({ type: "NOTIFICATION_CREATED" });

    await delay(50);
    expect(service.state.context.hasNewNotifications).toBe(true);
    mockInstances[0].simulateClose();

    await delay(50);
    expect(service.state.matches("disconnected")).toBe(true);
    expect(service.state.context.hasNewNotifications).toBe(true);

    service.send({ type: "CLEAR_NEW_NOTIFICATIONS" });
    expect(service.state.context.hasNewNotifications).toBe(false);
    service.stop();
  });

  it("should return to idle on DISCONNECT", async () => {
    const service = interpret(webSocketMachine).start();
    service.send({ type: "CONNECT", url: "ws://localhost:3001/ws" });

    await delay(50);
    mockInstances[0].simulateOpen();

    await delay(50);
    expect(service.state.matches({ active: "connected" })).toBe(true);
    service.send({ type: "DISCONNECT" });
    expect(service.state.matches("idle")).toBe(true);
    service.stop();
  });
});
