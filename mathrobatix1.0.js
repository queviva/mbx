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
    // #region CLASS METHS
    #rectObserver = new ResizeObserver((entries) => {
      const props = ["width", "height", "x", "y"];
      for (const entry of entries) {
        const el = entry.target;
        const rect = el.getBoundingClientRect();
        const style = el.style;
        for (const prop of props) {
          style.setProperty(`--full-${prop}`, Math.round(rect[prop]) + "px");
        }
        log("updating in observer");
      }
    });

    constructor(container) {
      this._container = container;
      this._supRegex = /([^\s])\^(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g;
      this._subRegex = /([^\s])\_(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g;
      this._allowed = new Set(["id"]);
      this._stepCount = 0;
      this._stageString;
      this._stageObject;
      this._targets = new Set();
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

    _measureElements(...els) {
      const props = ["width", "height", "x", "y"];
      for (const el of new Set(els)) {
        const rect = el.getBoundingClientRect();
        const style = el.style;
        for (const prop of props) {
          style.setProperty(`--full-${prop}`, Math.round(rect[prop]) + "px");
        }
        //this.#rectObserver.observe(el);
      }
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
      this.#rectObserver.disconnect();
      this._container.replaceChildren();
      this._stepCount = 0;
      this._targets = new Set();

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
      //await new Promise((r) => setTimeout(r, 1000));
      this._stepCount++;
      const stepID = `${devOpts.fix}-s${this._stepCount}`;

      if (step.load) {
        this._stageString = step.load;
      }

      const stage = this._makeTag("b", this._stageString, "stage");
      const comm = this._makeTag("b", step.note || "", "comm");
      const stepDiv = this._makeTag("div", "", "step");

      stepDiv.append(stage, comm);
      stepDiv.classList.add("measure");
      this._container.append(stepDiv);

      this._stageObject = stage;

      stage.querySelectorAll("[id]").forEach((el) => {
        this._measureElements(el);
      });

      let actsResult;
      if (typeof step.acts === "function") {
        try {
          actsResult = step.acts(this);
          if (actsResult && typeof actsResult.then === "function") {
            await actsResult;
          }
        } catch (err) {
          console.warn("Spotter: step.acts error", err);
        }
      }

      // Now that any measurement/setup is complete, namespace IDs and finalize.
      this._namespaceIDs(stage, stepID);

      // Remove measurement class to make the step visible / interactive.
      stepDiv.classList.remove("measure");

      // Dispatch the step-ready event for consumers.
      this._dispatchReady(stepDiv);
    }
    // #endregion

    // #region API
    select(...ids) {
      const unique = [...new Set(ids)];
      this._targets = unique
        .map((id) => {
          return this._stageObject.querySelector(`[id="${id}"]`);
        })
        .filter((el) => el !== null);
      return this;
    }

    // #region WRAP TYPES
    _wrap(type, cssVars) {
      this._targets.forEach((el) => {
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
    grow(scale) {
      return this._wrap("grow", scale ? { "--grow-val": scale } : null);
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

      this._targets.forEach((el) => {
        const fc = el.firstChild;
        if (start != null) fc.style.setProperty("--ani-start", start);
        if (end != null) fc.style.setProperty("--ani-end", end);
      });

      return this;
    }
    // #endregion

    // #region ABSORB
    absorb(id, html) {
      const absEl = this._makeTag("b", "<b></b><b></b>", "absorb");
      const newEl = this._makeTag("b", html);
      newEl.id = id;
      this._stageObject.insertBefore(absEl, this._targets[0]);
      this._targets.forEach((el) => {
        absEl.children[0].append(el);
      });
      absEl.children[1].append(newEl);

      this._measureElements(absEl.children[0], absEl.children[1]);

      return this.select(newEl.id);
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
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  // #endregion
})(document, document.currentScript);
