import { cleanup, render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KeyExtract, SafeDial } from "@/components/Minigames";
import { LockPick } from "@/components/LockPick";
import { Profiler } from "react";

// rAF-driven games: drive the animation loop manually.
function installRaf() {
  let cbs: FrameRequestCallback[] = [];
  const now = { v: 2000 };
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cbs.push(cb);
    return cbs.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    cbs = [];
  });
  return {
    tick(ms: number) {
      now.v += ms;
      const pending = cbs;
      cbs = [];
      pending.forEach((cb) => cb(now.v));
    },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("minigames", () => {
  it("SafeDial completes after three good stops", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const raf = installRaf();
    const onDone = vi.fn();
    const { container } = render(<SafeDial onDone={onDone} />);
    const needleEl = () => container.querySelector('[data-testid="dial-needle"]') as HTMLElement;
    // sweep the dial and stop exactly when the needle sits inside the green wedge
    const num = (re: RegExp, s: string) => parseFloat(s.match(re)?.[1] ?? "0");
    for (let i = 0; i < 500; i++) {
      const angle = num(/rotate\((-?[\d.]+)deg\)/, needleEl().style.transform);
      // Every target is zero degrees. Click when the actual displayed needle is at twelve.
      if (angle === 0) {
        fireEvent.click(screen.getByText("STOP ON MARK"));
        if (onDone.mock.calls.length) break;
      } else {
        act(() => raf.tick(16));
      }
    }
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it("LockPick fails after three bad taps", () => {
    const onDone = vi.fn();
    render(<LockPick pins={4} onDone={onDone} />);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByText("SET PIN"));
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it("KeyExtract fails when the pull is held crooked", () => {
    const raf = installRaf();
    const onDone = vi.fn();
    render(<KeyExtract onDone={onDone} />);
    const btn = screen.getByText("HOLD TO PULL");
    fireEvent.pointerDown(btn);
    // the needle wanders; enough crooked ticks must trip the snap risk
    for (let i = 0; i < 400; i++) act(() => raf.tick(50));
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it("KeyExtract succeeds with steady pulls, including Tim's easier mode", () => {
    const raf = installRaf();
    const onDone = vi.fn();
    const { container } = render(<KeyExtract easy onDone={onDone} />);
    const button = screen.getByText("HOLD TO PULL");
    for (let i = 0; i < 1800 && !onDone.mock.calls.length; i++) {
      const fragment = container.querySelector('[data-testid="extract-position"]') as HTMLElement;
      const position = Number(fragment.style.transform.match(/([\d.]+)%/)?.[1] ?? "50") / 100;
      if (Math.abs(position - 0.5) < 0.2) fireEvent.pointerDown(button);
      else fireEvent.pointerUp(button);
      act(() => raf.tick(16));
    }
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it("animates all three games without a React render on every frame", () => {
    const raf = installRaf();
    const renderCount = vi.fn();
    const { unmount } = render(
      <Profiler id="games" onRender={renderCount}>
        <LockPick pins={4} onDone={() => {}} />
        <KeyExtract onDone={() => {}} />
        <SafeDial onDone={() => {}} />
      </Profiler>,
    );
    const initial = renderCount.mock.calls.length;
    for (let i = 0; i < 60; i++) act(() => raf.tick(16));
    expect(renderCount.mock.calls.length).toBe(initial);
    unmount();
  });

  it("reports completion only once even with repeated taps", () => {
    const onDone = vi.fn();
    render(<LockPick pins={4} onDone={onDone} />);
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByText("SET PIN"));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(false);
  });
});
