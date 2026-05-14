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
    // #region PRIVATE FIELDS
    #routine = {};
    #container;
    #opts = {};
    #supRegex = /([^\s])\^(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g;
    #subRegex = /([^\s])\_(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g;
    #apis = [
      "viva",
      "grow",
      "shrink",
      "vaporize",
      "spin",
      "vault",
      "tuck",
      "filter-clear",
      "move",
    ];
    #allowed = new Set(["id"]);
    #stepCount = 0;
    #stageString;
    #stageObject;
    #targets = new Set();
    // !!! HAKC !!!
    #resizeRunning = false;
    #resizeTimer = null;
    // #endregion

    constructor(container, opts = {}) {
      this.#container = container;
      this.#opts = opts;
      // !!! HAKC !!!
      // #region
      // I dare you to think of another functional way
      /*
      window.addEventListener("resize", (e) => {
        this.loadRoutine(this.#routine);
      });
      */
      this.#resizeRunning = false;
      this.#resizeTimer = null;
      window.addEventListener("resize", () => {
        clearTimeout(this.#resizeTimer);
        this.#resizeTimer = setTimeout(async () => {
          if (this.#resizeRunning) return;
          this.#resizeRunning = true;
          try {
            await this.loadRoutine(this.#routine);
          } finally {
            this.#resizeRunning = false;
          }
        }, 200);
      });
      // #endregion
    }

    // #region PRIVATE METHS
    #sanitizeHTML(html = "") {
      if (!html) return document.createDocumentFragment();

      const marked = String(html)
        .trim()
        .replace(/\s+/g, " ")
        .replace(
          this.#supRegex,
          (m, base, sup) => `${base}<b data-sup>${sup}</b>`,
        )
        .replace(
          this.#subRegex,
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
          const text = node.textContent;
          if (!text) {
            node.parentNode.removeChild(node);
          }
          //else {
          // const wrapper = this.#makeTag("b", text);
          // node.parentNode.replaceChild(wrapper, node);
          // node = wrapper;
          // }
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
              if (!this.#allowed.has(name) && !name.startsWith("data-")) {
                node.removeAttribute(attr.name);
              }
            }
          }
        }

        node = nextNode;
      }

      return tpl.content;
    }

    #makeTag(tag, html, attr) {
      const el = document.createElement(tag);
      el.append(this.#sanitizeHTML(html));
      if (attr) el.setAttribute(`data-${attr}`, "");
      return el;
    }

    #measureElements(...els) {
      const props = ["width", "height", "x", "y"];
      for (const el of new Set(els)) {
        const rect = el.getBoundingClientRect();
        const style = el.style;
        for (const prop of props) {
          style.setProperty(
            `--${devOpts.fix}-${prop}`,
            Math.round(rect[prop]) + "px",
          );
        }
      }
    }

    #namespaceIDs(stage, prefix) {
      stage.querySelectorAll("[id]").forEach((el) => {
        el.id = `${prefix}-${el.id}`;
      });
    }

    #removeIDs(stage) {
      stage.querySelectorAll("[id]").forEach((el) => {
        el.removeAttribute("id");
      });
    }

    #dispatchReady(step) {
      const stepReady = new CustomEvent(`${devOpts.fix}-step-ready`, {
        detail: { time: Date.now() },
        bubbles: true,
        composed: true,
      });
      step.dispatchEvent(stepReady);
    }
    // #endregion

    async loadRoutine(routine = {}) {
      this.#routine = routine;
      this.#container.replaceChildren();
      this.#stepCount = 0;
      this.#targets = new Set();

      if (routine.intro) {
        this.#container.append(
          this.#sanitizeHTML(`<b data-intro>${routine.intro}</b>`),
        );
      }

      this.#stageString = routine.stage || "";

      for (let step of routine.steps || []) {
        await this.#processStep(step);
      }
    }

    async #processStep(step) {
      // await new Promise((r) => setTimeout(r, 1000));
      this.#stepCount++;
      const stepID = `${devOpts.fix}-s${this.#stepCount}`;

      if (step.load) this.#stageString = step.load;

      const stage = this.#makeTag("b", this.#stageString, "stage");
      const comm = this.#makeTag("b", step.note || "", "comm");
      const stepDiv = this.#makeTag("div", "", "step");
      stepDiv.append(stage, comm);
      stepDiv.classList.add("measure");
      this.#container.append(stepDiv);

      this.#stageObject = stage;

      // layout HAKC
      await new Promise((r) => requestAnimationFrame(r));

      this.#stageObject.querySelectorAll("[id]").forEach((el) => {
        this.#measureElements(el);
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

      const nextStep = this.#makeTag("div", stepDiv.innerHTML, "step");

      // remove absorbs from stage
      nextStep.querySelectorAll("[data-absorb]").forEach((el) => {
        el.parentNode.insertBefore(el.children[1], el);
        el.remove();
      });

      // remove the API <b>'s
      for (const api of this.#apis) {
        nextStep.querySelectorAll(`[data-${api}]`).forEach((el) => {
          while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
          el.remove();
        });
      }
      this.#stageString = nextStep.children[0].innerHTML;

      this.#removeIDs(stepDiv.children[0]);
      stepDiv.classList.remove("measure");
      this.#dispatchReady(stepDiv);
    }

    // #region MATHROBATIX
    spot(...ids) {
      const unique = [...new Set(ids)];
      this.#targets = unique
        .map((id) => {
          return this.#stageObject.querySelector(`[id="${CSS.escape(id)}"]`);
        })
        .filter((el) => el !== null);
      return this;
    }

    mount(id, html, data) {
      const el = this.#makeTag("b", html, "stage");
      el.id = id;
      this.#stageObject.append(el);
      this.#measureElements(el);
      return this.spot(el.id);
    }

    insertBefore(id) {
      const beef = this.#stageObject.querySelector(`[id="${CSS.escape(id)}"]`);
      if (!beef) return this;
      this.#targets.forEach((el) => {
        el.parentNode.insertBefore(el, beef);
      });
    }

    insertAfter(id) {
      const beef = this.#stageObject.querySelector(`[id="${CSS.escape(id)}"]`);
      if (!beef) return this;
      this.#targets.forEach((el) => {
        el.parentNode.insertBefore(el, beef.nextSibling);
      });
    }

    hide() {
      this.#targets.forEach((el) => {
        el.style.display = "none";
      });
    }

    dismount() {
      this.#targets.forEach((el) => {
        el.remove();
      });
    }
    // #endregion

    // #region WRAP TYPES
    #wrap(type, cssVars) {
      for (const el of this.#targets) {
        el.innerHTML = `<b data-${type}>${el.innerHTML}</b>`;
        if (cssVars) {
          for (const [key, value] of Object.entries(cssVars)) {
            el.children[0].style.setProperty(key, value);
          }
        }
      }
      return this;
    }
    viva() {
      return this.#wrap("viva");
    }
    ghost() {
      return this.#wrap("ghost");
    }
    vaporize() {
      return this.#wrap("vaporize");
    }
    grow(scale) {
      return this.#wrap("grow", scale ? { "--grow-val": scale } : null);
    }
    shrink() {
      return this.#wrap("shrink");
    }
    spin(deg) {
      return this.#wrap("spin", deg ? { "--spin-angle": deg } : null);
    }
    vault(high) {
      return this.#wrap("vault", high ? { "--vault-height": high } : null);
    }
    tuck() {
      return this.#wrap("tuck");
    }
    unfurl() {
      const targets = this.#targets;
      const total = targets.length;
      for (const [i, el] of targets.entries()) {
        this.spot(el.id).#wrap("grow", {
          "--ani-start": i / total,
        });
      }
      this.#targets = targets;
      return this;
    }
    // #endregion

    // #region FILTERS
    filterClear() {
      return this.#wrap("filter-clear");
    }

    filter(type) {
      for (const el of this.#targets) {
        el.setAttribute("data-filter", type);
      }
      return this;
    }
    // #endregion

    // #region DURING
    during(start, end = null) {
      const s = start != null ? Math.max(0, Math.min(1, start)) : null;
      const e = end != null ? Math.max(0, Math.min(1, end)) : null;

      this.#targets.forEach((el) => {
        const fc = el.children[0];
        if (start != null) fc.style.setProperty("--ani-start", start);
        if (end != null) fc.style.setProperty("--ani-end", end);
      });

      return this;
    }
    // #endregion

    // #region ABSORB
    absorb(id, html) {
      const absEl = this.#makeTag("b", "<b></b><b></b>", "absorb");
      const newEl = this.#makeTag("b", html);
      newEl.id = id;
      this.#stageObject.insertBefore(absEl, this.#targets[0]);
      this.#targets.forEach((el) => {
        absEl.children[0].append(el);
      });
      absEl.children[1].append(newEl);

      this.#measureElements(absEl.children[0], absEl.children[1]);

      return this.spot(newEl.id);
    }
    // #endregion

    // #region MOVE LOGIC
    moveBefore(anchorId) {
      return this.#move(anchorId, "before");
    }

    moveAfter(anchorId) {
      return this.#move(anchorId, "after");
    }

    #move(anchorId, direction) {
      const anchor = this.#stageObject.querySelector(
        `[id="${CSS.escape(anchorId)}"]`,
      );
      if (!anchor) return this;

      const allElements = Array.from(
        this.#stageObject.querySelectorAll("[id]"),
      );

      const snapshots = new Map();
      for (const el of allElements) {
        snapshots.set(el.id, el.getBoundingClientRect());
      }

      const targetArray =
        direction === "after"
          ? Array.from(this.#targets).reverse()
          : Array.from(this.#targets);

      for (const el of targetArray) {
        const ref = direction === "before" ? anchor : anchor.nextSibling;
        anchor.parentNode.insertBefore(el, ref);
      }

      for (const el of allElements) {
        const oldRect = snapshots.get(el.id);
        const newRect = el.getBoundingClientRect();

        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;

        // don't make little jiggles
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          el.innerHTML = `<b data-move>${el.innerHTML}</b>`;
          const wrapper = el.children[0];
          wrapper.style.setProperty("--dx", `${Math.round(dx)}px`);
          wrapper.style.setProperty("--dy", `${Math.round(dy)}px`);
        }
      }

      return this;
    }
    // #endregion
  }
  // #endregion

  // #region MBX TAG
  class MBX extends HTMLElement {
    #opts;
    #spotter;

    constructor() {
      super();
      // !!! DO NOT USE SHADOW DOM !!!
      this.#opts = { ...devOpts };
    }

    loadRoutine(routine) {
      this.#spotter.loadRoutine(routine);
    }

    connectedCallback() {
      const tagOpts = this.dataset[devOpts.fix];
      this.#opts = sieve(this.#opts, parseData(tagOpts));
      // setup options for this tag
      // style color, size, &c.
      //this.style.setProperty("--main-color", "#909");
      const readyEvent = new CustomEvent(`${this.#opts.fix}-ready`, {
        detail: { time: Date.now() },
        bubbles: true,
        composed: true,
      });
      this.#spotter = new Spotter(this, this.#opts);
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
