import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { timAnimationState } from "@/lib/game";
import { Route } from "@/routes/index";

vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@/lib/leaderboard.functions", () => ({ finishRankedMatch: vi.fn() }));
vi.mock("@/components/GameMenu", () => ({
  GameMenu: ({ onStart }: { onStart: (config: object) => void }) => (
    <button onClick={() => onStart({ technician: "Matt", playerCount: 4, difficulty: "medium", displayName: "Matt", rankedId: null })}>Start test match</button>
  ),
}));

vi.mock("@/components/City3D", () => ({
  City3D: ({ onEvent }: { onEvent: (event: string) => void }) => (
    <button onClick={() => onEvent("tim")}>Visit Tim</button>
  ),
}));
vi.mock("@/lib/sfx", () => ({
  sfx: { ring: vi.fn() },
  setMuted: vi.fn(),
  startBackgroundAudio: vi.fn(),
  stopBackgroundAudio: vi.fn(),
}));
vi.mock("@/lib/radio", () => ({
  RadioPlaylist: class {
    dispose() {}
  },
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  timAnimationState.smoking = false;
});

describe("Tim's visible smoking state", () => {
  it("grants the tip while the rendered animation is smoking, regardless of wall-clock phase", () => {
    timAnimationState.smoking = true;
    const Game = Route.options.component as () => React.ReactNode;
    render(<Game />);
    fireEvent.click(screen.getByText("Start test match"));
    fireEvent.click(screen.getByText("Visit Tim"));
    fireEvent.click(screen.getByText("Thanks, Tim"));
    expect(screen.getByText(/Tim's tip: reach a job/)).toBeTruthy();
  });
  it("offers no reward when the rendered animation is not smoking", () => {
    timAnimationState.smoking = false;
    const Game = Route.options.component as () => React.ReactNode;
    render(<Game />);
    fireEvent.click(screen.getByText("Start test match"));
    fireEvent.click(screen.getByText("Visit Tim"));
    expect(screen.queryByText("Thanks, Tim")).toBeNull();
    fireEvent.click(screen.getByText("Catch you later, Tim"));
    expect(screen.queryByText(/Tim's tip: reach a job/)).toBeNull();
  });
});
