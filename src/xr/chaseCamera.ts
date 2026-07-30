/**
 * WebXR's local forward vector is -Z, while the hydroboard's heading zero
 * advances along +Z. Rotate the player origin half a turn to keep the board in
 * front of the rider.
 */
export function getXrChaseYaw(heading: number): number {
  return heading + Math.PI
}
