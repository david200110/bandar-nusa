// Keyboard + mouse input. Builds one plain input object per frame:
// { forward, back, left, right, run, enter, punch, handbrake, pause, mute,
//   confirm, dragYaw, dragPitch, zoom, clicked }.
// Edge-triggered actions (enter, punch, pause, mute, confirm, clicked) are
// consumed by the game loop: read them once per frame, then they clear.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    forward: false,
    back: false,
    left: false,
    right: false,
    run: false,
    handbrake: false,
    enter: false,
    punch: false,
    pause: false,
    mute: false,
    confirm: false,
    clicked: false,
    dragYaw: 0,
    dragPitch: 0,
    zoom: 0,
  };
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function key(e, down) {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (down) {
      if (k === 'e') state.enter = true;
      if (k === 'f') state.punch = true;
      if (k === 'escape' || k === 'p') state.pause = true;
      if (k === 'm') state.mute = true;
      if (k === 'enter') state.confirm = true;
    }
    if (down) keys.add(k);
    else keys.delete(k);
  }

  const onKeyDown = (e) => key(e, true);
  const onKeyUp = (e) => key(e, false);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const onDown = (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onMove = (e) => {
    if (!dragging) return;
    state.dragYaw -= (e.clientX - lastX) * 0.005;
    state.dragPitch += (e.clientY - lastY) * 0.004;
    state.dragPitch = Math.max(-0.1, Math.min(0.9, state.dragPitch));
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onUp = (e) => {
    if (dragging && Math.abs(e.clientX - lastX) < 4 && Math.abs(e.clientY - lastY) < 4) {
      state.clicked = true;
    }
    dragging = false;
  };
  const onWheel = (e) => {
    state.zoom += Math.sign(e.deltaY);
  };
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });

  return {
    // Held keys, refreshed every frame.
    poll() {
      state.forward = keys.has('w') || keys.has('arrowup');
      state.back = keys.has('s') || keys.has('arrowdown');
      state.left = keys.has('a') || keys.has('arrowleft');
      state.right = keys.has('d') || keys.has('arrowright');
      state.run = keys.has('shift');
      state.handbrake = keys.has(' ');
      return state;
    },
    // One-shot actions: read then clear.
    consume() {
      const out = {
        enter: state.enter,
        punch: state.punch || state.clicked,
        pause: state.pause,
        mute: state.mute,
        confirm: state.confirm,
        dragYaw: state.dragYaw,
        dragPitch: state.dragPitch,
        zoom: state.zoom,
      };
      state.enter = false;
      state.punch = false;
      state.pause = false;
      state.mute = false;
      state.confirm = false;
      state.clicked = false;
      state.dragYaw = 0;
      state.dragPitch = 0;
      state.zoom = 0;
      return out;
    },
  };
}
