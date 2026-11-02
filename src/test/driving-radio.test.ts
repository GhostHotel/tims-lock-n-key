import { afterEach, describe, expect, it, vi } from "vitest";
import { drivingInput, resetGameInput, setDrivingKey, setTouchInput } from "@/lib/driving-input";
import { buildingPush, drivingSurfaceHeight } from "@/lib/game";
import { RadioPlaylist, RADIO_TRACKS } from "@/lib/radio";

afterEach(resetGameInput);
describe("driving reset", () => {
  it("clears keyboard flags and every held touch direction", () => {
    setDrivingKey("KeyW", true);
    setDrivingKey("ArrowLeft", true);
    setTouchInput("right", true);
    setTouchInput("down", true);
    expect(Object.values(drivingInput).every(Boolean)).toBe(true);
    resetGameInput();
    expect(drivingInput).toEqual({ up: false, down: false, left: false, right: false });
    setTouchInput("down", false);
    expect(drivingInput.up).toBe(false);
    expect(drivingInput.left).toBe(false);
  });
  it("ignores held-key repeats and new keys while a dialog is open", () => {
    setDrivingKey("KeyW", true);
    resetGameInput();
    setDrivingKey("KeyW", true, true);
    setDrivingKey("KeyA", true, false, true);
    expect(drivingInput.up).toBe(false);
    expect(drivingInput.left).toBe(false);
    setDrivingKey("KeyW", false);
    setDrivingKey("KeyW", true);
    expect(drivingInput.up).toBe(true);
  });
});
describe("curb cutting", () => {
  it("allows crossing the curb and grass but not building walls", () => {
    expect(buildingPush(-53, -53)).toBeNull();
    expect(buildingPush(-53.5, -56)).toBeNull();
    expect(buildingPush(-60, -60)).not.toBeNull();
    expect(buildingPush(0, 3)).not.toBeNull();
    expect(drivingSurfaceHeight(-53, -53)).toBeCloseTo(0.175);
    expect(drivingSurfaceHeight(-53.5, -53.5)).toBeCloseTo(0.35);
  });
});
describe("four-track radio", () => {
  function setup() {
    const audio = document.createElement("audio");
    const play = vi.spyOn(audio, "play").mockResolvedValue();
    const pause = vi.spyOn(audio, "pause").mockImplementation(() => {});
    vi.spyOn(audio, "load").mockImplementation(() => {});
    return { audio, play, pause, radio: new RadioPlaylist(audio) };
  }
  it("plays all four uploaded tracks in order, then loops to the first", () => {
    const { audio, play, radio } = setup();
    expect(RADIO_TRACKS).toHaveLength(4);
    radio.setOn(true);
    for (const index of [1, 2, 3, 0]) {
      audio.dispatchEvent(new Event("ended"));
      expect(audio.getAttribute("src")).toBe(RADIO_TRACKS[index]);
    }
    expect(play).toHaveBeenCalledTimes(5);
    radio.dispose();
  });
  it("off pauses and on resumes the same position, independently of main mute", () => {
    const { audio, play, pause, radio } = setup();
    radio.setOn(true);
    audio.currentTime = 42;
    radio.setOn(false);
    expect(pause).toHaveBeenCalledTimes(1);
    audio.dispatchEvent(new Event("ended"));
    expect(audio.getAttribute("src")).toBe(RADIO_TRACKS[0]);
    radio.setMuted(true);
    radio.setOn(true);
    expect(audio.muted).toBe(true);
    expect(audio.currentTime).toBe(42);
    expect(play).toHaveBeenCalledTimes(2);
    radio.dispose();
  });
});
