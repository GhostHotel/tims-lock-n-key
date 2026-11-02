export interface DrivingInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}
export const drivingInput: DrivingInput = { up: false, down: false, left: false, right: false };
const pressedKeys = new Set<string>();
const touchInput: DrivingInput = { up: false, down: false, left: false, right: false };
const directions = ["up", "down", "left", "right"] as const;
const keyMap: Record<string, keyof DrivingInput> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};
function update() {
  for (const direction of directions) {
    drivingInput[direction] =
      touchInput[direction] || [...pressedKeys].some((key) => keyMap[key] === direction);
  }
}
/** One reset for keyboard flags, touch holds, and all movement directions. */
export function resetGameInput() {
  pressedKeys.clear();
  for (const direction of directions) touchInput[direction] = drivingInput[direction] = false;
}
export function setTouchInput(direction: keyof DrivingInput, down: boolean) {
  touchInput[direction] = down;
  update();
}
export function setDrivingKey(code: string, down: boolean, repeat = false, blocked = false) {
  if (!keyMap[code]) return false;
  if (!down) pressedKeys.delete(code);
  else if (!repeat && !blocked) pressedKeys.add(code);
  update();
  return true;
}
