((doc, self) => {
  // #region UTILS
  const log = console.log;

  const sieve = (target, incoming) => {
    const src = incoming && typeof incoming === "object" ? incoming : {};
    return Object.fromEntries(
      Object.keys(target).map((key) => [
        key,
        Object.prototype.hasOwnProperty.call(src, key) ? src[key] : target[key],
      ]),
    );
  };

  const parseData = (raw) => {
    if (!raw || typeof raw !== "string") return {};
    try {
      const trimmed = raw.trim().replace(/\s+/g, " ");
      return JSON.parse(trimmed);
    } catch (e) {
      return {};
    }
  };

  const dispatchReady = (el, type) => {
    el.parentNode.dispatchEvent(
      new CustomEvent(`${type || devOpts.fix}-ready`, {
        detail: { time: Date.now() },
        bubbles: true,
        composed: true,
      }),
    );
  };

  // #endregion

  // #region OPTS
  const defOpts = {
    tag: "mathro-batix",
    fix: "mbx",
    color: 300,
  };

  const devOpts = sieve(
    defOpts,
    parseData(Object.entries(self?.dataset || {})[0]?.[1]),
  );
  // #endregion

  // #region SPOTTER
  class Spotter {
    #opts;
    #holder = null;
    #routine = {};
    #routineCount = 0;
    #currentStepNumber = 0;

    constructor(holder, opts = {}) {
      this.#holder = holder;
      this.#opts = { ...opts };
      // !!! RESIZE BUG HAKC !!!
      window.addEventListener("resize", (e) => {
        this.loadRoutine(this.#routine);
      });
    }

    #svgString() {
      const UUID = crypto.randomUUID();
      return `
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <mask id="${UUID}"><rect width="100" height="100" fill="#000"/><path/></mask>
        <path mask="url(#${UUID})"/>
      </svg>
      `;
    }

    async loadRoutine(routine = {}) {
      this.#holder.replaceChildren();
      this.#routine = routine;
      const currentRoutineNumber = ++this.#routineCount;
      this.#currentStepNumber = 0;

      if (routine.intro)
        this.#holder.insertAdjacentHTML("afterBegin", routine.intro);

      for (let step of routine.steps || []) {
        if (currentRoutineNumber !== this.#routineCount) break;
        const ok = await this.#processStep(
          step,
          currentRoutineNumber,
          this.#currentStepNumber,
        );
        if (!ok) break;
      }
    }

    async #processStep(step, routineNumber, stepNumber) {
      await new Promise((r) => setTimeout(r, 1000));

      const stuff = document.createElement("b");
      stuff.setAttribute("data-comm", "");
      stuff.innerHTML = step.note || "";
      stuff.insertAdjacentHTML("afterBegin", this.#svgString());

      if (routineNumber === this.#routineCount) {
        this.#holder.append(stuff);
        dispatchReady(this.#holder, `${this.#opts.fix}-step-${stepNumber}`);
        ++this.#currentStepNumber;
      } else {
        log(`killed ${stepNumber}`);
        return false;
      }
      return true;
    }

    disconnect() {
      // cleanup
    }
  }
  // #endregion

  // #region MBX
  class MBX extends HTMLElement {
    #ID;
    #tagOpts;
    #spotter;
    #holder;

    constructor() {
      super();
      this.#tagOpts = { ...devOpts };
      this.#spotter = null;
      this.#holder = null;
    }

    async connectedCallback() {
      await new Promise((r) => setTimeout(r, 500));

      this.#tagOpts = sieve(
        this.#tagOpts,
        parseData(this.dataset[devOpts.fix]),
      );

      this.innerHTML = "";

      const holder = document.createElement("b");
      holder.setAttribute("data-holder", "");
      holder.style.setProperty("--mbx-h", this.#tagOpts.color);
      this.append(holder);
      this.#holder = holder;

      this.#spotter = new Spotter(this.#holder, this.#tagOpts);

      dispatchReady(this.#holder, this.#tagOpts.fix);
    }

    disconnectedCallback() {
      if (this.#spotter?.disconnect) this.#spotter.disconnect();
      this.#spotter = null;
    }

    loadRoutine(routine = {}) {
      this.#spotter.loadRoutine(routine);
    }
  }
  // #endregion

  // #region INIT
  const boot = async () => {
    if (!customElements.get(devOpts.tag)) {
      customElements.define(devOpts.tag, MBX);
    }
  };

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", boot)
    : boot();
  // #endregion
})(document, document.currentScript);
