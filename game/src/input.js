// Keyboard and mouse input for Bandar Nusa. Tracks held keys and camera
// drag; the game loop reads the state each frame.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const state = {
    keys,
    // Camera orbit deltas accumulated from mouse drags.
    yawDelta: 0,
    pitchDelta: 0,
    // Set true once the player has pressed anything (used to start audio).
    interacted: false,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    pressed.add(event.code);
    state.interacted = true;
    // Keep the page from scrolling on game keys.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onPointerDown(event) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    state.interacted = true;
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    state.yawDelta -= (event.clientX - lastX) * 0.005;
    state.pitchDelta -= (event.clientY - lastY) * 0.004;
    state.pitchDelta = Math.max(-0.6, Math.min(0.6, state.pitchDelta));
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onPointerUp() {
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  state.held = (code) => keys.has(code);
  // Edge trigger: true only on the first frame that sees this press.
  state.pressed = (code) => {
    if (!pressed.has(code)) return false;
    pressed.delete(code);
    return true;
  };
  state.axis = () => {
    let x = 0;
    let z = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    return { x, z };
  };
  // Consume the accumulated camera drag so each delta is applied once.
  state.consumeLook = () => {
    const out = { yaw: state.yawDelta, pitch: state.pitchDelta };
    state.yawDelta = 0;
    state.pitchDelta = 0;
    return out;
  };
  state.dispose = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
  };
  return state;
}
