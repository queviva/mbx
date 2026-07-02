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
    if (!el?.parentNode) return;
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
    css: "mathrobatix2.0.css"
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
      "colorize",
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

      let markup = String(html).trim();

      markup = markup
        .replace(/\s+/g, " ")
        .replace(
          /([^\s])\^(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g,
          "$1<b data-sup>$2</b>",
        )
        .replace(
          /([^\s])\_(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g,
          "$1<b data-sub>$2</b>",
        );

      const tpl = document.createElement("template");
      tpl.innerHTML = markup;

      const walker = document.createTreeWalker(
        tpl.content,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null,
      );

      let node = walker.nextNode();
      while (node) {
        const nextNode = walker.nextNode();

        if (node.nodeType === Node.TEXT_NODE) {
          if (!node.textContent.trim()) {
            node.parentNode?.removeChild(node);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase();

          if (tag !== "b") {
            const parent = node.parentNode;
            if (parent) {
              while (node.firstChild) {
                parent.insertBefore(node.firstChild, node);
              }
              parent.removeChild(node);
            }
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
            `--${this.#opts.fix}-${prop}`,
            Math.round(rect[prop]) + "px",
          );
        }
      }
    }

    #removeAbsorbs(step) {
      for (const el of step.querySelectorAll("[data-absorb]")) {
        while (el.children[1].firstChild)
          el.parentNode.insertBefore(el.children[1].firstChild, el);
        el.remove();
      }
    }

    #removeDists(step) {
      for (const el of step.querySelectorAll("[data-coeff]")) {
        el.remove();
      }
      for (const el of step.querySelectorAll("[data-term] > [data-vaporize]")) {
        el.remove();
      }
    }

    #resetFraks(step) {
      for (const el of step.querySelectorAll("[data-frak-anim]")) {
        el.removeAttribute("data-frak-anim");
        // el.setAttribute("data-frak", "");
        el.innerHTML = `<b data-frak>${el.innerHTML}</b>`;
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

              X.spot("T3", "Ty").log("y");
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
            beef.parentNode.insertBefore(el, beef.nextSibling);
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

        moveBefore: (id) => move(id, "before"),
        moveAfter: (id) => move(id, "after"),
        // #endregion

        // #region FILTERS
        viva: () => wrap("viva"),
        ghost: () => wrap("ghost"),
        vaporize: () => wrap("vaporize"),
        colorize: (v) => wrap("colorize", { [`--${spotter.#opts.fix}-h`]: v }),
        setColor: (v) => {
          for (const el of spotter.#targets) {
            el.style.setProperty(`--${spotter.#opts.fix}-h`, v);
            el.style.color = "var(--main-color)";
          }
          return api;
        },
        filterClear: () => wrap("filter-clear"),
        filter: (type) => {
          for (const el of spotter.#targets) {
            el.setAttribute("data-filter", type);
          }
          return api;
        },
        // #endregion

        // #region GROWTH
        grow: () => {
          for (const el of this.#targets) {
            el.setAttribute("data-grow", "");
          }
          log("growing!!");
          return api;
        },
        shrink: () => {
          for (const el of this.#targets) {
            el.setAttribute("data-shrink", "");
          }
          return;
          api;
        },
        vault: (v) => wrap("vault", v ? { "--vault-height": v } : null),
        tuck: (v) => wrap("tuck", v ? { "--tuck-depth": v } : null),
        spin: (v) => wrap("spin", v ? { "--spin-angle": v } : null),
        // #endregion

        // #region ANIMATES
        cank: (v, rot) =>
          svgWrap("cank", v || null, rot ? { "--cank-rotate": rot } : null),
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
          const target0 = spotter.#targets[0];
          const absEl = spotter.#makeTag("b", "<b></b><b></b>", "absorb");
          target0.parentNode.insertBefore(absEl, target0);
          for (const el of spotter.#targets) {
            absEl.children[0].append(el);
          }
          for (const id of new Set(ids)) {
            absEl.children[1].append(api.pick(id));
          }

          spotter.#measureElements(absEl.children[0], absEl.children[1]);

          return api.spot(...ids);
        },
        dist: (id) => {
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
        root: (id) => {
          const target0 = spotter.#targets[0];
          id = id || `${spotter.#opts.fix}${crypto.randomUUID()}`;
          const rootEl = document.createElement("b");
          rootEl.id = CSS.escape(id);
          rootEl.setAttribute("data-root-anim", "");
          rootEl.innerHTML = `
           <b id="${CSS.escape(id)}" data-root-terms></b>
           <svg data-front-svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path/>
           </svg>
           <svg data-top-svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path/>
           </svg>
          `;
          target0.parentNode.insertBefore(rootEl, target0);
          const termB = rootEl.querySelector("[data-root-terms]");
          for (const el of spotter.#targets) {
            termB.append(el);
          }
          return api.spot(id);
        },
        frak: (...ids) => {
          if (!spotter.#targets.length) return api;
          const target0 = spotter.#targets[0];

          const divEl = document.createElement("b");
          divEl.innerHTML = `
           <b id="${spotter.#targets[0].id}-frak" data-frak-anim>
            <b data-numerator>
             <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path data-frak-anim-slash />
             </svg>
            </b>
            <b data-denominator></b>
           </b>
          `;
          target0.parentNode.insertBefore(divEl, target0);
          const numer = divEl.querySelector("[data-numerator]");
          const denom = divEl.querySelector("[data-denominator]");
          for (const el of spotter.#targets) numer.append(el);
          for (const id of new Set(ids)) denom.append(api.pick(id));
        },
        // #endregion
        powerRule: () => {
          const targets = spotter.#targets;
          for (const el of targets) {
            el.innerHTML = `<b data-power-rule>${el.innerHTML}</b>`;
            const sup = el.querySelector("[data-sup]");
            if (!sup) return api;
            sup.id = sup.id || `${spotter.#opts.fix}-${crypto.randomUUID()}`;
            sup.innerHTML = `
              <b data-power-rule-expo>
                <b id="${sup.id}-expo-move" data-sup data-power-rule-expo-move>
                  ${sup.innerText}
                  <b data-power-rule-dot>&middot;</b>
                </b>
                <b data-power-rule-expo-copy>${sup.innerText}</b>
                <b data-filter="viva" data-grow style="--ani-start:0.5">-1</b>
              </b>
            `;
            api.spot(`${sup.id}-expo-move`).moveBefore(el.id);
          }
          spotter.#targets = targets;
          return api;
        },

        // #region !!! STILL TO DO !!!
        moreMethods() {
          return [
            "power rule - for derivate and integral",
            "redux - opposite of frak",
            "split - opposite of absorb",
            "faktor - opposite of distribute",
            "colorize - better css layout of coloring/filters",
            "cross-fade",
          ];
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
      this.#removeAbsorbs(nextStep);

      // remove distributions from stage
      this.#removeDists(nextStep);

      // reset the fraktions
      this.#resetFraks(nextStep);

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

    connectedCallback() {
      this.#opts = sieve(opts, parseData(this.dataset[opts.fix]));

      this.innerHTML = `<b data-holder style="--${this.#opts.fix}-h:${this.#opts.color};"></b>`;

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
    const rez = await fetch(opts.css);
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
