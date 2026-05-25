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
    #apis = [
      "viva",
      "ghost",
      "vaporize",
      "grow",
      "shrink",
      "spin",
      "vault",
      "tuck",
      "filter-clear",
      "move",
      "cank",
      "cirk",
      "term",
      "original",
    ];
    #allowed = new Set(["id"]);
    #stageString = null;
    #stageObject = null;
    #targets = new Set();
    // #endregion

    constructor(holder, opts) {
      this.#holder = holder;
      this.#opts = opts;
      // this.#resizeHandler = () => this.loadRoutine(this.#routine);
      // window.addEventListener("resize", this.#resizeHandler);
    }

    // #region PRIVATE METHS
    #createStepTag(step) {
      const stepTag = this.#makeTag("b", "", "step");
      const stage = this.#makeTag("b", this.#stageString, "stage");
      const comm = this.#makeTag("b", step.note || "", "comm");
      this.#stageObject = stage;
      stepTag.setAttribute("data-measure", "");
      stepTag.append(stage, comm);
      return stepTag;
    }

    #sanitizeHTML(html = "") {
      if (!html) return document.createDocumentFragment();

      const marked = String(html)
        .trim()
        .replace(/\s+/g, " ")
        .replace(
          /([^\s])\^(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g,
          (m, base, sup) => `${base}<b data-sup>${sup}</b>`,
        )
        .replace(
          /([^\s])\_(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g,
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

    #makeTag(tag, html, ...attrs) {
      const el = document.createElement(tag);
      el.append(this.#sanitizeHTML(html));
      for (const attr of new Set((attrs || []).filter((a) => a != null))) {
        el.setAttribute(`data-${attr}`, "");
      }
      return el;
    }

    #measureElements(...els) {
      const props = ["width", "height", "x", "y"];
      for (const el of new Set(els)) {
        const rect = el.getBoundingClientRect();
        const style = el.style;
        for (const prop of props) {
          style.setProperty(
            `--${opts.fix}-${prop}`,
            Math.round(rect[prop]) + "px",
          );
        }
      }
    }

    #removeAborbs(step) {
      for (const el of step.querySelectorAll("[data-absorb]")) {
        while (el.children[1].firstChild)
          el.parentNode.insertBefore(el.children[1].firstChild, el);
        el.remove();
      }
    }

    #removeDist(step) {
      for (const el of step.querySelectorAll("[data-coeff]")) {
        el.remove();
      }
      for (const el of step.querySelectorAll("[data-term] > [data-vaporize]")) {
        el.remove();
      }
    }

    #removeAPIs(step) {
      for (const api of this.#apis) {
        for (const el of step.querySelectorAll(`[data-${api}]`)) {
          while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
          el.remove();
        }
      }
    }

    #namespaceIDs(stage, stepNum) {
      for (const el of stage.querySelectorAll("[id]")) {
        el.id = `${this.#opts.fix}-step-${stepNum}-${el.id}`;
      }
    }

    #removeIDs(stage) {
      for (const el of stage.querySelectorAll("b[id]")) {
        el.removeAttribute("id");
      }
    }
    // #endregion

    #makeAPI(el, routineNum, signal) {
      // #region API UTILS
      const spotter = this;
      const move = (anchorId, direction) => {
        const anchor = spotter.#stageObject.querySelector(
          `[id="${CSS.escape(anchorId)}"]`,
        );
        if (!anchor) return api;

        const allElements = Array.from(
          spotter.#stageObject.querySelectorAll("[id]"),
        );

        const snapshots = new Map();
        for (const el of allElements) {
          snapshots.set(el.id, el.getBoundingClientRect());
        }

        const targetArray =
          direction === "after"
            ? Array.from(spotter.#targets).reverse()
            : Array.from(spotter.#targets);

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
        return api;
      };
      const wrap = (type, cssVars) => {
        for (const el of spotter.#targets) {
          el.innerHTML = `<b data-${type}>${el.innerHTML}</b>`;
          if (cssVars) {
            for (const [key, value] of Object.entries(cssVars)) {
              el.children[0].style.setProperty(key, value);
            }
          }
        }
        return api;
      };
      const svgWrap = (type, data, cssVars) => {
        const id = `${spotter.#opts.fix}-${crypto.randomUUID()}`;
        for (const el of spotter.#targets) {
          el.innerHTML = `
            <b data-${type}="${data || null}">
              <b>${el.innerHTML}</b>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <clipPath id="${id}"><path/></clipPath>
                <path clip-path="url(#${id})"/>
              </svg>
            </b>
          `;
          if (cssVars) {
            for (const [key, value] of Object.entries(cssVars)) {
              el.children[0].style.setProperty(key, value);
            }
          }
        }
        return api;
      };
      // #endregion

      const api = {
        // #region FUNDAMENTALS
        pick: (id) => {
          return (
            spotter.#stageObject?.querySelector(`[id="${CSS.escape(id)}"]`) ||
            null
          );
        },
        spot: (...ids) => {
          const unique = [...new Set(ids)];
          spotter.#targets = unique
            .map((id) => api.pick(id))
            .filter((el) => el !== null);
          return api;
        },
        mount: (id, html, ...attrs) => {
          const el = spotter.#makeTag("b", html, ...attrs);
          el.id = CSS.escape(id);
          spotter.#stageObject?.append(el);
          spotter.#measureElements(el);
          return api.spot(el.id);
        },
        dismount: () => {
          for (const el of spotter.#targets) {
            el.remove();
          }
        },
        insertBefore: (id) => {
          const beef = api.pick(id);
          if (!beef) return api;
          for (const el of spotter.#targets) {
            el.parentNode.insertBefore(el, beef);
          }
          return api;
        },
        insertAfter: (id) => {
          const beef = api.pick(id);
          if (!beef) return api;
          for (const el of spotter.#targets) {
            el.parentNode.insertBefore(el, beef.nextSibling);
          }
          return api;
        },
        alter: (html) => {
          for (const el of spotter.#targets) {
            el.replaceChildren(spotter.#sanitizeHTML(html));
            spotter.#measureElements(el);
          }
        },
        hide: () => {
          for (const el of api.#targets) {
            el.style.display = "none";
          }
          return api;
        },
        show: () => {
          for (const el of api.#targets) {
            el.style.display = "revert";
          }
          return api;
        },
        during: (start, end = null) => {
          const s = start != null ? Math.max(0, Math.min(1, start)) : null;
          const e = end != null ? Math.max(0, Math.min(1, end)) : null;

          spotter.#targets.forEach((el) => {
            const fc = el.children[0];
            if (start != null) fc.style.setProperty("--ani-start", start);
            if (end != null) fc.style.setProperty("--ani-end", end);
          });

          return api;
        },

        moveBefore: (anchorId) => move(anchorId, "before"),
        moveAfter: (anchorId) => move(anchorId, "after"),
        // #endregion

        // #region FILTERS
        viva: () => wrap("viva"),
        ghost: () => wrap("ghost"),
        vaporize: () => wrap("vaporize"),
        filterClear: () => wrap("filter-clear"),
        filter: (type) => {
          for (const el of spotter.#targets) {
            el.setAttribute("data-filter", type);
          }
          return api;
        },
        // #endregion

        // #region GROWTH
        grow: () => wrap("grow"),
        shrink: () => wrap("shrink"),
        vault: (v) => wrap("vault", v ? { "--vault-height": v } : null),
        tuck: (v) => wrap("tuck", v ? { "--tuck-depth": v } : null),
        spin: (v) => wrap("spin", v ? { "--spin-angle": v } : null),
        // #endregion

        // #region ANIMATES
        cank: (v, rot) => svgWrap("cank", v || null, rot ? {"--cank-rotate":rot} : null),
        cirk: (v) => svgWrap("cirk", v || null),
        // #endregion

        // #region NEEDS UNDO
        unfurl: () => {
          const targets = spotter.#targets;
          const total = targets.length;
          for (const [i, el] of targets.entries()) {
            api.spot(el.id);
            wrap("grow", { "--ani-start": i / total });
          }
          spotter.#targets = targets;
          return api;
        },
        absorb: (...ids) => {
          const absEl = spotter.#makeTag("b", "<b></b><b></b>", "absorb");
          spotter.#stageObject.insertBefore(absEl, spotter.#targets[0]);
          spotter.#targets.forEach((el) => {
            absEl.children[0].append(el);
          });
          for (const id of new Set(ids)) {
            absEl.children[1].append(api.pick(id));
          }

          spotter.#measureElements(absEl.children[0], absEl.children[1]);

          return api.spot(...ids);
        },
        dist(id) {
          const targets = spotter.#targets;
          const total = targets.length;
          const coeff = api.pick(id);
          const co_txt = coeff.innerText;
          api.spot(id).vaporize().during(0, 0.5).shrink().during(0.5);
          coeff.setAttribute("data-coeff", "");
          for (const [i, el] of targets.entries()) {
            api
              .mount(`${coeff.id}-${el.id}`, co_txt, "grow-term")
              .grow()
              .during(0.6 + (i / total) * 0.4)
              .insertBefore(el.id)
              .viva();
            el.innerHTML = `
             <b data-term>
              <b data-vaporize style="--ani-start:${0.25 + (i / total) * 0.4};--ani-end:${0.85 + (i / total) * 0.2}">${el.innerText}</b>
              <b data-original>${el.innerHTML}</b>
             </b>
            `;
          }
          return api.spot(id);
        },
        // #endregion

        isAlive: () => routineNum === spotter.#routineNum && !signal?.aborted,
      };
      return api;
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

    async #processStep(step, routineNum, signal) {
      // check if this should even run
      if (signal?.aborted || routineNum !== this.#routineNum) return false;

      // !!! REMOVE !!! testing stall
      await new Promise((r) => setTimeout(r, 800));

      // load new stage if needed
      if (step.load) this.#stageString = step.load;

      // make the step tags
      const stepTag = this.#createStepTag(step);

      // should we keep going and add the tag?
      if (signal?.aborted || routineNum !== this.#routineNum) return false;
      this.#holder.append(stepTag);

      // !!! layout HAKC - must be here !!!
      await new Promise((r) => requestAnimationFrame(r));

      // set measurements
      this.#measureElements(...this.#stageObject.querySelectorAll("[id]"));

      // try to run the actions
      const acted = await this.#runActs(step, stepTag, routineNum, signal);

      // check if that werked
      if (!acted) return false;

      // copy the step tags for next time
      const nextStep = this.#makeTag("b", stepTag.innerHTML, "step");

      // remove absorbs from stage
      this.#removeAborbs(nextStep);

      // remove distributions from stage
      this.#removeDist(nextStep);

      // remove the API <b>'s
      this.#removeAPIs(nextStep);

      // reset the stage string to trimmed tags
      this.#stageString = nextStep.children[0].innerHTML;

      // remove IDs [or make namespaceIDs()]
      this.#removeIDs(stepTag.children[0]);

      // should this still BE finalized?
      if (signal?.aborted || routineNum !== this.#routineNum) {
        stepTag.remove();
        return false;
      }

      // the tag is done with measurements
      stepTag.removeAttribute("data-measure");

      // let em know you're rockin
      dispatch(
        this.#holder,
        `${this.#opts.fix}-step-${this.#currentStep}-ready`,
      );

      // now you can increment the step
      this.#currentStep++;

      // let the rez know
      return true;
    }

    async loadRoutine(routine = {}) {
      if (this.#abortCtrl) this.#abortCtrl.abort();
      this.#abortCtrl = new AbortController();

      this.#holder.replaceChildren();
      this.#routine = routine;
      const routineNum = ++this.#routineNum;
      this.#currentStep = 0;

      if (routine.intro)
        this.#holder.append(this.#makeTag("b", routine.intro, "intro"));

      this.#stageString = routine.stage || "";

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

    #svgString() {
      const filterID = this.#opts.fix + "-" + crypto.randomUUID();
      return `
        <svg height="0" width="0" style="--hue:${this.#opts.color};">
          <filter id="${filterID}" x="-200%" y="-200%" height="900%" width="900%">
            <feGaussianBlur stdDeviation="0.3" result="B0" />
            <feFlood flood-color="hsl(var(--hue), 80%, 90%)" result="F0" />
            <feComposite in="F0" in2="B0" operator="in" result="Z0" />
            <feGaussianBlur stdDeviation="2" result="B1" />
            <feFlood flood-color="hsl(calc(var(--hue) + 12), 80%, 50%)" result="F1" />
            <feComposite in="F1" in2="B1" operator="in" result="Z1" />
            <feGaussianBlur stdDeviation="3" result="B2" />
            <feFlood flood-color="hsl(calc(var(--hue) - 20), 50%, 45%)" result="F2" />
            <feComposite in="F2" in2="B2" operator="in" result="Z2" />
            <feGaussianBlur stdDeviation="4" result="B3" />
            <feFlood flood-color="hsl(calc(var(--hue) - 40), 98%, 50%)" result="F3" />
            <feComposite in="F3" in2="B3" operator="in" result="Z3" />
            <feGaussianBlur stdDeviation="8" result="B4" />
            <feFlood flood-color="hsl( var(--hue), 98%, 50%)" result="F4" />
            <feComposite in="F4" in2="B4" operator="in" result="Z4" />
            <feMerge>
              <feMergeNode in="Z4" />
              <feMergeNode in="Z3" />
              <feMergeNode in="Z2" />
              <feMergeNode in="Z1" />
              <feMergeNode in="Z0" />
            </feMerge>
          </filter>
        </svg>
        <b data-holder style="--${this.#opts.fix}-h:${this.#opts.color}; --viva-filterID: url(#${filterID}); "></b>
      `;
    }

    connectedCallback() {
      this.#opts = sieve(opts, parseData(this.dataset[opts.fix]));

      this.innerHTML = this.#svgString();

      this.#spotter = new Spotter(this.children[1], this.#opts);

      dispatch(this.children[1], `${this.#opts.fix}-ready`);
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
    const rez = await fetch("mathrobatix2.0.css");
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
