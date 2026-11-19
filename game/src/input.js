// Keyboard and mouse. Keys are read live every frame; one-shot actions (enter a
// car, punch, pause, mute) are edges — pressed() is true only on the frame the key
// went down, so holding E does not spam the action.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const EDGE_CODES = ['Enter', 'Space', 'Escape', 'KeyP', 'KeyE', 'KeyF', 'KeyM'];

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let clicked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    if (EDGE_CODES.includes(event.code)) pressed.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
  });

  canvas.addEventListener('mousedown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    clicked = true;
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    mouseDX += event.clientX - lastX;
    mouseDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });

  function isDown(code) {
    return down.has(code);
  }

  // WASD / arrows: forward is -1 on y (W), strafe on x.
  function moveAxis() {
    let x = 0;
    let y = 0;
    if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
    if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
    if (isDown('KeyW') || isDown('ArrowUp')) y -= 1;
    if (isDown('KeyS') || isDown('ArrowDown')) y += 1;
    return { x, y };
  }

  function takeMouse() {
    const delta = { x: mouseDX, y: mouseDY };
    mouseDX = 0;
    mouseDY = 0;
    return delta;
  }

  function takeClick() {
    const was = clicked;
    clicked = false;
    return was;
  }

  function takeActions() {
    let actions = 0;
    if (pressed.has('Enter') || pressed.has('Space')) actions |= ACTION_CONFIRM;
    if (pressed.has('Escape') || pressed.has('KeyP')) actions |= ACTION_PAUSE;
    if (pressed.has('KeyE')) actions |= ACTION_INTERACT;
    if (pressed.has('KeyF')) actions |= ACTION_PUNCH;
    if (pressed.has('KeyM')) actions |= ACTION_MUTE;
    pressed.clear();
    return actions;
  }

  return { isDown, moveAxis, takeMouse, takeClick, takeActions };
}
