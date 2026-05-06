((doc, self) => {
  // #region UTILS
  const log = console.log;

  // !!! HAKC !!!  pull in external css
  /*
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "mathrobatics.css";
  document.head.appendChild(link);
  */

  const sieve = (target, incoming) => {
    return Object.fromEntries(
      Object.keys(target).map((key) => [
        key,
        incoming.hasOwnProperty(key) ? incoming[key] : target[key],
      ]),
    );
  };

  const parseData = (raw) => {
    try {
      return JSON.parse(raw.replace(/\s+/g, " "));
    } catch (e) {
      return {};
    }
  };
  // #endregion

  // #region OPTS
  const defOpts = {
    tag: "mathro-batix",
    fix: "mbx",
  };

  const devOpts = sieve(defOpts, parseData(Object.entries(self.dataset)[0][1]));
  // #endregion

  // #region SPOTTER
  class Spotter {
    constructor(routine) {
      // maybe this takes a routine ?
      this.routine = routine;
      this.routine.stage = this.routine.stage.trim().replace(/\s+/g, " ");
      this.routine.stage.querySelectorAll("b").forEach(b => {
        log(b.id)
      })
    }
  }
  // #endregion

  // #region MBX TAG
  class MBX extends HTMLElement {
    constructor() {
      super();
      // !!! DO NOT USE SHADOW DOM !!!
      this._opts = { ...devOpts };
      this._spotter;
    }

    loadRoutine(routine) {
      this._spotter = new Spotter(routine);
      log(this._spotter.routine);
    }

    connectedCallback() {
      const instanceRaw = this.dataset[devOpts.fix];
      if (instanceRaw) {
        this._opts = sieve(this._opts, parseData(instanceRaw));
      }
      const readyEvent = new CustomEvent(`${devOpts.fix}-ready`, {
        detail: { time: Date.now() },
        bubbles: true,
        composed: true,
      });

      this.dispatchEvent(readyEvent);
    }
  }

  // #endregion

  // #region INIT

  const boot = () => {
    if (!customElements.get(devOpts.tag)) {
      customElements.define(devOpts.tag, MBX);
    }

    // !!! DEBUGG !!! INJECT GLOBAL CSS
    /*
    const style = document.createElement("style");
    style.textContent = `
      ${devOpts.tag} { }
    `;
    document.head.appendChild(style);
    */
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  // #endregion
})(document, document.currentScript);
