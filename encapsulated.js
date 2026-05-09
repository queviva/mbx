((doc, self) => {
  // #region UTILS
  const log = console.log;

  // !!! HAKC !!!  pull in external css
  /*
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "mathrobatix.css";
  document.head.appendChild(link);
  */

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
      const cleaned = raw.trim().replace(/\s+/g, " ");
      return JSON.parse(cleaned);
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

  const devOpts = sieve(
    defOpts,
    parseData(Object.entries(self?.dataset || {})[0]?.[1]),
  );
  // #endregion

  // #region TERM
  class Term {
    constructor(id, innerHTML) {
      this.id = id;
      this.coreHTML = innerHTML;
      this.element = null;
      this.visible = true;
      this.build();
    }

    build() {
      this.element = document.createElement("b");
      this.element.innerHTML = this.coreHTML;
    }

    wrap(type) {
      const wrapper = document.createElement("b");
      wrapper.dataset[type] = "";
      wrapper.innerHTML = this.element.outerHTML;
      this.element = wrapper;
      return this;
    }

    setTiming(start, end) {
      if (!this.element) return this;
      if (start != null) this.element.style.setProperty("--ani-start", start);
      if (end != null) this.element.style.setProperty("--ani-end", end);
      return this;
    }

    render() {
      return this.visible ? this.element.outerHTML : "";
    }
  }
  // #endregion

  // #region SPOTTER
  class Spotter {
    constructor(container) {
      this.sequence = [];
      this.terms = new Map();
      this.container = container;
      this._lastTargets = [];
      this._powRegex = /([^\s])\^(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g;
    }

    async loadRoutine(routine) {
      this.routine = routine;
      this.sequence = [];
      this.terms.clear();
      this._lastTargets = [];

      if (!routine.stage) return;

      const template = document.createElement("div");
      template.innerHTML = routine.stage
        .trim()
        .replace(this._powRegex, "$1<sup>$2</sup>");

      for (let node of template.childNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const html = node.outerHTML;
          const term = new Term(node.id, node.innerHTML);
          this.sequence.push(term);
          if (term.id) this.terms.set(term.id, term);
        } else if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          if (text.trim() !== "") {
            const term = new Term(null, text);
            this.sequence.push(term);
          }
        }
      }

      if (routine.intro) {
        this.appendStep(
          `<b data-comm style="margin-bottom:20vh">${routine.intro}</b>`,
        );
      }

      for (let step of routine.steps || []) {
        await this.processStep(step);
      }
    }

    async processStep(step) {
      if (typeof step.acts === "function") {
        step.acts(this);
      }

      const equationHTML = this.renderCurrentEquation();
      const stepHTML = `<div data-step><b>${equationHTML}</b><b data-comm>${step.note || ""}</b></div>`;

      this.appendStep(stepHTML);
      for (const term of this.terms.values()) {
        term.build();
      }
      await new Promise((r) => setTimeout(r, 8));
    }

    renderCurrentEquation() {
      return this.sequence
        .filter((t) => t.visible)
        .map((t) => t.render())
        .join("");
    }

    appendStep(html) {
      if (!this.container) return;
      const div = document.createElement("div");
      div.innerHTML = html;
      const XXX = div.firstElementChild;
      this.container.append(XXX);
      const stepReady = new CustomEvent(`${devOpts.fix}-step-ready`, {
        detail: { time: Date.now() },
        bubbles: true,
        composed: true,
      });
      XXX.dispatchEvent(stepReady);
    }

    // #region API CALLS

    _setTargets(...ids) {
      this._lastTargets = ids.filter((id) => this.terms.has(id));
      return this;
    }

    _wrap(type, ...ids) {
      const targets = ids.length ? ids : this._lastTargets;
      targets.forEach((id) => this.terms.get(id)?.wrap(type));
      return this._setTargets(...targets);
    }

    viva(...ids) {
      return this._wrap("viva", ...ids);
    }
    ghost(...ids){
      return this._wrap("ghost", ...ids);
    }
    shrink(...ids) {
      return this._wrap("shrink", ...ids);
    }
    grow(...ids) {
      return this._wrap("grow", ...ids);
    }
    vaporize(...ids) {
      return this._wrap("vaporize", ...ids);
    }
    absorb(...ids) {
      return this._wrap("absorb", ...ids);
    }

    during(start, end = null) {
      const s = start != null ? Math.max(0, Math.min(1, start)) : null;
      const e = end != null ? Math.max(0, Math.min(1, end)) : null;

      this._lastTargets.forEach((id) => {
        this.terms.get(id)?.setTiming(s, e);
      });
      return this;
    }

    insert(id, html) {
      const term = new Term(id, html);
      this.terms.set(id, term);
      this.sequence.push(term); // append at the end by default
      return this._setTargets(id);
    }

    before(targetId) {
      const target = this.terms.get(targetId);
      if (!target) return this;
      this._lastTargets.forEach((id, i) => {
        const t = this.terms.get(id);
        if (t) t.order = target.order - 0.1 * (i + 1);
      });
      return this;
    }

    after(targetId) {
      const target = this.terms.get(targetId);
      if (!target) return this;
      this._lastTargets.forEach((id, i) => {
        const t = this.terms.get(id);
        if (t) t.order = target.order + 0.1 * (i + 1);
      });
      return this;
    }
    // #endregion
  }
  // #endregion

  // #region MBX TAG
  class MBX extends HTMLElement {
    constructor() {
      super();
      // !!! DO NOT USE SHADOW DOM !!!
      this._opts = { ...devOpts };
      this._spotter = new Spotter(this);
    }

    loadRoutine(routine) {
      this._spotter.loadRoutine(routine);
    }

    connectedCallback() {
      const tagOpts = this.dataset[devOpts.fix];
      this._opts = sieve(this._opts, parseData(tagOpts));
      // setup options for this tag
      // style color, size, &c.
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

    // #region WIDTH SCRIPT
    const widthScript = (step) => {
      step
        .querySelectorAll(
          "[data-dist] > b, [data-grow], [data-shrink], [data-absorb] > b",
        )
        .forEach((el) => {
          el.style.animationTimeline = "none";
          el.style.animation = "none";
          el.style.setProperty("--full-width", el.offsetWidth + "px");
          el.style.animationTimeline = "view()";
          el.style.animation = "";
        });
    };
    document.addEventListener("mbx-step-ready", (e) => {
      const targ = e.target;
      widthScript(targ);
      window.addEventListener("resize", (e) => {
        widthScript(targ);
      });
    });
    // #endregion
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  // #endregion
})(document, document.currentScript);
