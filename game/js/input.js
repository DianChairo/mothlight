// input.js — keyboard and mouse state for the game.
//
// One Input object owns every listener. The game reads held keys and the
// mouse each fixed step, and asks pressed() for edge-triggered actions
// (pause, mute, confirm) so a held key never fires them twice.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.anyGesture = false;

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) {
        this.keys.add(event.code);
        this.pressedKeys.add(event.code);
      }
      this.anyGesture = true;
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });

    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      this.mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
      this.anyGesture = true;
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  down(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  pressed(...codes) {
    return codes.some((code) => this.pressedKeys.has(code));
  }

  // Called once at the end of each rendered frame: edge triggers live for
  // exactly one frame, held state persists until the key comes up.
  endFrame() {
    this.pressedKeys.clear();
    this.mouse.clicked = false;
  }
}
