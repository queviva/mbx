((doc, script) => {
  // #region UTILS
  const log = console.log;

  const sieve = (defaults, incoming) => ({
    ...defaults,
    ...(incoming && typeof incoming === "object" ? incoming : {}),
  });

  const parseData = (raw) => {
    if (typeof raw !== "string") return {};
    try {
      return JSON.parse(raw.trim().replace(/\s+/g, " "));
    } catch {
      return {};
    }
  };

  const dispatch = (el, name) => {
    el.parentNode.dispatchEvent(
      new CustomEvent(name, {
        detail: { time: Date.now() },
        bubbles: true,
        composed: true,
      }),
    );
  };
  // #endregion

  // #region OPTS
  const defaults = {
    tag: "mathro-batix",
    fix: "mbx",
    color: 300,
  };

  const opts = sieve(defaults, parseData(script?.dataset[defaults.fix]));
  // #endregion

  // #region SPOTTER
  class Spotter {
    // #region PRIVATE FIELDS
    #opts;
    #holder = null;
    #routine = {};
    #routineNum = 0;
    #currentStep = 0;
    #resizeHandler = null;
    #abortCtrl = null;
    #supRegex = /([^\s])\^(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g;
    #subRegex = /([^\s])\_(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g;
    #apis = [
      "viva",
      "grow",
      "shrink",
      "vaporize",
      "spin",
      "cank",
      "vault",
      "tuck",
      "filter-clear",
      "move",
    ];
    #allowed = new Set(["id"]);
    // #endregion

    constructor(holder, opts) {
      this.#holder = holder;
      this.#opts = opts;

      this.#resizeHandler = () => this.loadRoutine(this.#routine);
      window.addEventListener("resize", this.#resizeHandler);
    }

    // #region PRIVATE METHS
    #svgString() {
      const id = `${this.#opts.fix}-${crypto.randomUUID()}`;
      return `
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <mask id="${id}"><rect width="100" height="100" fill="#000"/><path/></mask>
          <path mask="url(#${id})"/>
        </svg>
      `;
    }

    #createStepHTML(step) {
      const el = document.createElement("b");
      el.setAttribute("data-comm", "");
      el.innerHTML = step?.note || "";
      el.insertAdjacentHTML("afterbegin", this.#svgString());
      return el;
    }

    async #runActs(step, el, routineNum, signal) {
      if (signal?.aborted || routineNum !== this.#routineNum) return false;
      if (typeof step.acts !== "function") return true;

      try {
        const api = this.#makeAPI(el, routineNum, signal);
        const result = step.acts(api, signal);
        if (result?.then) await result;
        return true;
      } catch {
        return false;
      }
    }

    #finalize(el, routineNum, stepNum, signal) {
      if (signal?.aborted || routineNum !== this.#routineNum) return false;

      this.#holder.append(el);
      dispatch(this.#holder, `${this.#opts.fix}-step-${stepNum}-ready`);
      this.#currentStep++;
      return true;
    }
    // #endregion

    async #processStep(step, routineNum, signal) {
      if (signal?.aborted || routineNum !== this.#routineNum) return false;

      // TEST STALL & NUMBER
      await new Promise((r) => setTimeout(r, 800));
      log(`${this.#holder.parentNode.id} #${routineNum}-${this.#currentStep} - ${Date.now()}`);

      const el = this.#createStepHTML(step);
      const acted = await this.#runActs(step, el, routineNum, signal);
      if (!acted) return false;


      return this.#finalize(el, routineNum, this.#currentStep, signal);
    }

    async loadRoutine(routine = {}) {
      if (this.#abortCtrl) this.#abortCtrl.abort();
      this.#abortCtrl = new AbortController();

      this.#holder.replaceChildren();
      this.#routine = routine;
      const routineNum = ++this.#routineNum;
      this.#currentStep = 0;

      if (routine.intro) {
        this.#holder.insertAdjacentHTML("afterbegin", routine.intro);
      }

      for (const step of routine.steps || []) {
        if (routineNum !== this.#routineNum) break;
        const success = await this.#processStep(
          step,
          routineNum,
          this.#abortCtrl.signal,
        );
        if (!success) break;
      }
    }

    #makeAPI(el, routineNum, signal) {
      const spotter = this;
      const api = {
        makeNote: (txt) => {
          return api;
        },
        changeHTML: (html) => {
          el.innerHTML = html;
          return api;
        },
        isAlive: () => routineNum === spotter.#routineNum && !signal?.aborted,
      };
      return api;
    }

    disconnect() {
      ++this.#routineNum;
      this.#abortCtrl?.abort();
      window.removeEventListener("resize", this.#resizeHandler);
      this.#holder?.replaceChildren();

      this.#holder = null;
      this.#abortCtrl = null;
      this.#resizeHandler = null;
      this.#routine = {};
    }
  }
  // #endregion

  // #region MBX
  class MBX extends HTMLElement {
    #spotter;
    #opts;

    constructor() {
      super();
    }

    connectedCallback() {
      this.#opts = sieve(opts, parseData(this.dataset[opts.fix]));

      this.innerHTML = `<b data-holder style="--${opts.fix}-h:${this.#opts.color}"></b>`;

      this.#spotter = new Spotter(this.children[0], this.#opts);

      dispatch(this.children[0], `${this.#opts.fix}-ready`);
    }

    disconnectedCallback() {
      this.#spotter?.disconnect();
      this.#spotter = null;
    }

    loadRoutine(routine) {
      this.#spotter?.loadRoutine(routine);
    }
  }
  // #endregion

  // #region INIT
  const boot = async () => {
    // INJECT CSS
    const rez = await fetch("skeleton.css");
    const CSSText = await rez.text();
    const styleTag = document.createElement("style");
    styleTag.textContent = CSSText.replaceAll(
      defaults.tag,
      opts.tag,
    ).replaceAll(defaults.fix, opts.fix);
    document.head.appendChild(styleTag); // No await needed

    // REGISTER TAG
    if (!customElements.get(opts.tag)) {
      customElements.define(opts.tag, MBX);
    }
  };

  doc.readyState === "loading"
    ? doc.addEventListener("DOMContentLoaded", boot)
    : boot();
  // #endregion
})(document, document.currentScript);
