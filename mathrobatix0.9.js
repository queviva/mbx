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

  // #region SPOTTER
  class Spotter {
    constructor(container) {
      this._container = container;
      this._supRegex = /([^\s])\^(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g;
      this._subRegex = /([^\s])\_(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g;
      this._allowed = new Set(["id"]);
      this._stepCount = 0;
      this._stageString;
      this._stageObject;
      this._targets = [];
    }

    _sanitizeHTML(html = "") {
      if (!html) return document.createDocumentFragment();

      const marked = String(html)
        .trim()
        .replace(/\s+/g, " ")
        .replace(
          this._supRegex,
          (m, base, sup) => `${base}<b data-sup>${sup}</b>`,
        )
        .replace(
          this._subRegex,
          (m, base, sub) => `${base}<b data-sub>${sub}</b>`,
        );

      const tpl = document.createElement("template");
      tpl.innerHTML = marked;

      const walker = document.createTreeWalker(
        tpl.content,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null,
      );

      let node = walker.nextNode();
      while (node) {
        const nextNode = walker.nextNode();
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent.length === 0) {
            node.parentNode.removeChild(node);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase();
          if (tag !== "b") {
            while (node.firstChild) {
              node.parentNode.insertBefore(node.firstChild, node);
            }
            node.parentNode.removeChild(node);
          } else {
            for (const attr of Array.from(node.attributes)) {
              const name = attr.name.toLowerCase();
              if (!this._allowed.has(name) && !name.startsWith("data-")) {
                node.removeAttribute(attr.name);
              }
            }
          }
        }

        node = nextNode;
      }

      return tpl.content;
    }

    _makeTag(tag, html, attr) {
      const el = document.createElement(tag);
      el.append(this._sanitizeHTML(html));
      if (attr) el.setAttribute(`data-${attr}`, "");
      return el;
    }

    _namespaceIDs(stage, prefix) {
      stage.querySelectorAll("[id]").forEach((el) => {
        el.id = `${prefix}-${el.id}`;
      });
    }

    _dispatchReady(step) {
      const stepReady = new CustomEvent(`${devOpts.fix}-step-ready`, {
        detail: { time: Date.now() },
        bubbles: true,
        composed: true,
      });
      step.dispatchEvent(stepReady);
    }

    async loadRoutine(routine = {}) {
      this._container.replaceChildren();
      this._stepCount = 0;
      this._targets = [];

      if (routine.intro) {
        this._container.append(
          this._sanitizeHTML(`<b data-intro>${routine.intro}</b>`),
        );
      }

      this._stageString = routine.stage || "";

      for (let step of routine.steps || []) {
        await this.processStep(step);
      }
    }

    async processStep(step) {
      // !!! DEBUGG !!!
      await new Promise((r) => setTimeout(r, 1000));

      this._stepCount++;
      const stepID = `${devOpts.fix}-s${this._stepCount}`;

      if (step.load) {
        this._stageString = step.load;
      }

      const stage = this._makeTag("b", this._stageString, "stage");
      const comm = this._makeTag("b", step.note || "", "comm");
      const stepDiv = this._makeTag("div", "", "step");

      this._stageObject = stage;

      if (typeof step.acts === "function") step.acts(this);

      this._namespaceIDs(stage, stepID);
      stepDiv.append(stage, comm);
      this._container.append(stepDiv);
      this._dispatchReady(stepDiv);
    }

    // #region API
    select(...ids) {
      this._targets = new Set(ids);
      return this;
    }

    // #region WRAP TYPES
    _wrap(type, cssVars) {
      this._targets.forEach((id) => {
        const el = this._stageObject.querySelector(`[id="${id}"]`);
        el.innerHTML = `<b data-${type}>${el.innerHTML}</b>`;
        if (cssVars) {
          for (const [key, value] of Object.entries(cssVars)) {
            el.firstChild.style.setProperty(key, value);
          }
        }
      });
      return this;
    }
    viva() {
      return this._wrap("viva");
    }
    ghost() {
      return this._wrap("ghost");
    }
    vaporize() {
      return this._wrap("vaporize");
    }
    grow() {
      return this._wrap("grow");
    }
    shrink() {
      return this._wrap("shrink");
    }
    spin(deg) {
      return this._wrap("spin", deg ? { "--spin-angle": deg } : null);
    }
    // #endregion

    // #region DURING
    during(start, end = null) {
      const s = start != null ? Math.max(0, Math.min(1, start)) : null;
      const e = end != null ? Math.max(0, Math.min(1, end)) : null;

      this._targets.forEach((id) => {
        const el = this._stageObject.querySelector(`[id="${id}"]`).firstChild;
        if (start != null) el.style.setProperty("--ani-start", start);
        if (end != null) el.style.setProperty("--ani-end", end);
      });

      return this;
    }
    // #endregion

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
  // #endregion

  // #region MOVIE SCRIPT
  const movieScript = (el) => {
    const items = Array.from(el.children);

    const firstRects = items.map((el) => el.getBoundingClientRect());

    const order = el.dataset.move.split(" ").map(Number);

    const reordered = order.map((i) => items[i]);
    reordered.forEach((child, i) => {
      child.style.order = i;
    });

    const lastRects = items.map((el) => el.getBoundingClientRect());

    items.forEach((el, i) => {
      const dx = firstRects[i].left - lastRects[i].left;
      const dy = firstRects[i].top - lastRects[i].top;

      el.style.setProperty("--dx", dx + "px");
      el.style.setProperty("--dy", dy + "px");

      el.classList.add("move");
    });
  };
  // #endregion

  // #region INIT
  const boot = async () => {
    if (!customElements.get(devOpts.tag)) {
      customElements.define(devOpts.tag, MBX);
    }

    // INJECT CSS
    // !!! DEBUGG !!! does not work
    /*
    const rez = await fetch("mathrobatix.css");
    const CSSText = await rez.text();
    const styleTag = document.createElement("style");
    styleTag.textContent = `
        ${CSSText}
    `;
    document.head.appendChild(styleTag);
    */

    // listen for width|movie
    document.addEventListener("mbx-step-ready", (e) => {
      const targ = e.target;
      widthScript(targ);
      window.addEventListener("resize", (e) => {
        widthScript(targ);
        targ.querySelectorAll("[data-step] [data-move]").forEach(movieScript);
      });
      targ.querySelectorAll("[data-step] [data-move]").forEach(movieScript);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  // #endregion
})(document, document.currentScript);
