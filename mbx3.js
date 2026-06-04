((doc, script) => {
  // #region UTILS
  const log = console.log;

  const sieve = (base, incoming) => {
    incoming = incoming && typeof incoming === "object" ? incoming : {};
    return Object.fromEntries(
      Object.keys(base).map((k) => [k, k in incoming ? incoming[k] : base[k]]),
    );
  };

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

  const timeoutPromise = (p, ms) => {
    if (ms <= 0) return Promise.resolve(p);

    const promise = Promise.resolve(p);
    const controller = new AbortController();
    let timerId;

    const tPromise = new Promise((_, reject) => {
      timerId = setTimeout(() => {
        controller.abort();
        reject(new Error("timed out"));
      }, ms);
    });

    return Promise.race([promise, tPromise]).finally(() => {
      clearTimeout(timerId);
    });
  };
  // #endregion

  // #region OPTS
  const defOpts = {
    tag: "mathro-batix",
    fix: "mbx",
    css: "mbx3.css",
    color: 33,
    timeout: 5000,
  };

  const devOpts = sieve(defOpts, parseData(script.dataset[defOpts.fix]));
  // #endregion

  // #region SPOTTER
  class Spotter {
    // #region PRIVATE FIELDS
    #opts;
    #holder = null;
    #isLoading = false;
    #routine = {};
    #routineNum = 0;
    #currentStep = 0;
    #stageObj = null;
    #batties = [];
    #apis = [
      "viva",
      "ghost",
      "vaporize",
      "materialize",
      "colorize",
      "wink",
      "filter-clear",
      "grow",
      "shrink",
      "spin",
      "vault",
      "tuck",
      "move",
      "cank",
      "cirk",
      "term",
      "original",
      "salute",
    ];
    #allowed = new Set(["id"]);
    // #endregion

    constructor(holder, opts) {
      this.#holder = holder;
      this.#opts = opts;
    }

    // #region SPOT UTILS
    #markup(html) {
      return html
        .trim()
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "> <")
        .replace(
          /([^\s])\^(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g,
          "$1<b data-sup>$2</b>",
        )
        .replace(
          /([^\s])\_(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g,
          "$1<b data-sub>$2</b>",
        );
    }

    #strip(html) {
      const markup = this.#markup(String(html));

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

      const tmpB = document.createElement("b");
      tmpB.appendChild(tpl.content.cloneNode(true));
      return tmpB.innerHTML;
    }

    #makeTag(tag, html, ...attrs) {
      const el = document.createElement(tag);
      el.innerHTML = this.#markup(html);
      for (const attr of new Set((attrs || []).filter((a) => a != null))) {
        el.setAttribute(`data-${attr}`, "");
      }
      return el;
    }

    #saniTag(tag, html, ...attrs) {
      return this.#makeTag(tag, this.#strip(html), ...attrs);
    }

    #makeStepTag(load, note) {
      const stepTag = this.#makeTag("b", "", "step");
      const stage = this.#makeTag("b", load, "stage");
      const comm = this.#makeTag("b", note, "comm");
      stepTag.setAttribute("data-measure", "");
      stepTag.append(stage, comm);
      return stepTag;
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

    #namespaceIDs(stage, stepNum) {
      for (const el of stage.querySelectorAll("[id]")) {
        el.id = `${this.#opts.fix}-step-${stepNum}-${el.id}`;
      }
    }
    // #endregion

    // #region REMOVE METHS
    #removeIDs(stage) {
      for (const el of stage.querySelectorAll("b[id]")) {
        el.removeAttribute("id");
      }
    }

    #removeAbsorbs(step) {
      for (const el of step.querySelectorAll("[data-absorb]")) {
        while (el.children[1].firstChild)
          el.parentNode.insertBefore(el.children[1].firstChild, el);
        el.remove();
      }
    }

    #removeXfades(step) {
      for (const el of step.querySelectorAll("[data-xfade]")) {
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
      for (const frak of step.querySelectorAll("[data-frak-anim]")) {
        frak.removeAttribute("data-frak-anim");
        frak.innerHTML = `<b data-frak>${frak.innerHTML}</b>`;
        // frak.innerHTML = frak.innerHTML.replace("-amin","");
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

    // #endregion

    #makeAPI = () => {
      // #region API UTILS
      const move = (anchorId, direction) => {
        const anchor = api.pick(anchorId);
        if (!anchor) return api;

        const allBats = Array.from(this.#stageObj.querySelectorAll("*"));

        const snapshots = new Map();
        for (const [i, bat] of allBats.entries()) {
          bat.id ||= `${this.#opts.fix}-${i}`;
          snapshots.set(bat.id, bat.getBoundingClientRect());
        }

        const batsArray =
          direction === "after"
            ? Array.from(this.#batties).reverse()
            : Array.from(this.#batties);

        for (const bat of batsArray) {
          const ref = direction === "before" ? anchor : anchor.nextSibling;
          anchor.parentNode.insertBefore(bat, ref);
        }

        for (const bat of allBats) {
          const oldRect = snapshots.get(bat.id);
          const newRect = bat.getBoundingClientRect();

          const dx = oldRect.left - newRect.left;
          const dy = oldRect.top - newRect.top;

          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            bat.innerHTML = `<b data-move>${bat.innerHTML}</b>`;
            const wrapper = bat.children[0];
            wrapper.style.setProperty("--dx", `${Math.round(dx)}px`);
            wrapper.style.setProperty("--dy", `${Math.round(dy)}px`);
          }
        }
        return api;
      };

      const wrap = (type, cssVars) => {
        for (const bat of this.#batties) {
          bat.innerHTML = `<b data-${type}>${bat.innerHTML}</b>`;
          if (cssVars) {
            for (const [key, value] of Object.entries(cssVars)) {
              bat.children[0].style.setProperty(key, value);
            }
          }
        }
        return api;
      };

      const svgWrap = (type, data, cssVars) => {
        const id = `${this.#opts.fix}-${crypto.randomUUID()}`;
        for (const bat of this.#batties) {
          bat.innerHTML = `
            <b data-${type}="${data || null}">
              <b>${bat.innerHTML}</b>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <clipPath id="${id}"><path/></clipPath>
                <path clip-path="url(#${id})"/>
              </svg>
            </b>
          `;
          if (cssVars) {
            for (const [key, value] of Object.entries(cssVars)) {
              bat.children[0].style.setProperty(key, value);
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
            this.#stageObj?.querySelector(`[id="${CSS.escape(id)}"]`) || null
          );
        },
        spot: (...ids) => {
          const unique = [...new Set(ids)];
          this.#batties = unique
            .map((id) => api.pick(id))
            .filter((bat) => bat !== null);
          return api;
        },
        spotAll: () => {
          this.#batties = [...this.#stageObj.querySelectorAll("*")];
          return api;
        },
        spotStage: () => {
          this.#batties = [this.#stageObj];
          return api;
        },
        mount: (id, html, ...attrs) => {
          const bat = this.#makeTag("b", html, ...attrs);
          bat.id = CSS.escape(id);
          this.#stageObj?.append(bat);
          this.#measureElements(bat);
          return api.spot(bat.id);
        },
        dismount: () => {
          for (const bat of this.#batties) {
            bat.remove();
          }
          return api;
        },
        insertBefore: (id) => {
          const beef = api.pick(id);
          if (!beef) return api;
          for (const bat of this.#batties) {
            bat.parentNode.insertBefore(bat, beef);
          }
          return api;
        },
        insertAfter: (id) => {
          const beef = api.pick(id);
          if (!beef) return api;
          for (const bat of this.#batties) {
            beef.parentNode.insertBefore(bat, beef.nextSibling);
          }
          return api;
        },
        alter: (html) => {
          for (const bat of this.#batties) {
            bat.replaceChildren(this.#strip(html));
            this.#measureElements(bat);
          }
          return api;
        },
        hide: () => {
          for (const bat of api.#batties) {
            bat.style.display = "none";
          }
          return api;
        },
        show: () => {
          for (const bat of api.#batties) {
            bat.style.display = "revert";
          }
          return api;
        },
        during: (start, end = null) => {
          const s = start != null ? Math.max(0, Math.min(1, start)) : null;
          const e = end != null ? Math.max(0, Math.min(1, end)) : null;

          for (const bat of this.#batties) {
            const fc = bat.children[0];
            if (start != null) fc.style.setProperty("--ani-start", start);
            if (end != null) fc.style.setProperty("--ani-end", end);
          }

          return api;
        },

        moveBefore: (id) => move(id, "before"),
        moveAfter: (id) => move(id, "after"),
        // #endregion

        // #region COLOR|FILTER
        viva: () => wrap("viva"),
        ghost: () => wrap("ghost"),
        vaporize: () => wrap("vaporize"),
        materialize: () => wrap("materialize"),
        filterClear: () => wrap("filter-clear"),
        filter: (type) => {
          for (const bat of this.#batties) {
            bat.setAttribute("data-filter", type);
          }
          return api;
        },
        colorize: (v) =>
          wrap("colorize", { [`--${this.#opts.fix}-colorize-val`]: v }),
        setColor: (v) => {
          for (const bat of this.#batties) {
            bat.style.setProperty(`--${this.#opts.fix}-h`, v);
          }
          return api;
        },
        // #endregion

        // #region GROWTH
        grow: () => wrap("grow"),
        shrink: () => wrap("shrink"),
        salute: () => wrap("salute"),
        vault: (v) => wrap("vault", v ? { "--vault-height": v } : null),
        tuck: (v) => wrap("tuck", v ? { "--tuck-depth": v } : null),
        spin: (v) => wrap("spin", v ? { "--spin-angle": v } : null),
        // #endregion

        // #region ANIMATES
        cank: (v, rot) =>
          svgWrap("cank", v || null, rot ? { "--cank-rotate": rot } : null),
        cirk: (v) => svgWrap("cirk", v || null),
        wink: (v = 1000) => {
          const batties = this.#batties;
          log(batties,'batties in wink');
          for (const bat of this.#batties) {
            api.spot(bat.id);
            wrap("wink");
            bat.style.setProperty("--mbx-wink-dur", `${v}ms`);
            const wink = bat.children[0];
            const anim = wink.getAnimations()?.[0];
            if (!anim) break;
            anim.onfinish = (e) => {
              bat.classList.add("mbx-wink");
              setTimeout(() => bat.classList.remove("mbx-wink"), v);
            };
          }
          this.#batties = batties;
          return api;
        },
        // #endregion

        // #region NEEDS UNDO
        dopple: (v = 1) => {
          if (!Number.isFinite(v) || v > 10) return;

          for (const bat of this.#batties) {
            const html = bat.innerHTML;
            bat.innerHTML = `
              <b data-dopple>
                <b id="${bat.id}-original">${html}</b>
              </b>
            `;
            for (let i = 0; i < v; i++) {
              const bbb = this.#makeTag("b", `<b>${html}</b>`);
              bbb.id = `${bat.id}-dopple${v > 1 ? i + 1 : ""}`;
              bat.children[0].append(bbb);
            }
            this.#measureElements(...bat.querySelectorAll("*"));
          }
          return api;
        },
        unfurl: () => {
          const batties = this.#batties;
          const total = batties.length;
          for (const [i, el] of batties.entries()) {
            api
              .spot(el.id)
              .grow()
              .during(i / total);
          }
          this.#batties = batties;
          return api;
        },
        absorb: (...ids) => {
          const batties = this.#batties;
          const bat0 = batties[0];
          const absID = `${ids[0]}-absorb`;

          api.mount(absID, "<b></b><b></b>", "original");
          wrap("absorb");

          const absEl = api.pick(absID);

          const [org, dop] = absEl.children[0].children;

          bat0.parentNode.insertBefore(absEl, bat0);

          for (const bat of batties) org.appendChild(bat);
          for (const id of new Set(ids)) dop.append(api.pick(id));

          this.#measureElements(absEl, ...absEl.children[0].children);

          return api.spot(absID);
        },
        xfade: (...ids) => {
          const batties = this.#batties;
          const bat0 = batties[0];
          const fadeID = `${ids[0]}-xfade`;

          api.mount(fadeID, "<b></b><b></b>", "original");
          wrap("xfade");

          const fadeEl = api.pick(fadeID);

          const [org, dop] = fadeEl.children[0].children;

          bat0.parentNode.insertBefore(fadeEl, bat0);

          for (const bat of batties) org.appendChild(bat);
          for (const id of new Set(ids)) dop.append(api.pick(id));

          this.#measureElements(fadeEl, ...fadeEl.children[0].children);

          fadeEl.children[0].style.setProperty(
            `--${this.#opts.fix}-xfade-wide0`,
            `${Math.round(org.getBoundingClientRect().width)}px`,
          );

          fadeEl.children[0].style.setProperty(
            `--${this.#opts.fix}-xfade-wide1`,
            `${Math.round(dop.getBoundingClientRect().width)}px`,
          );

          return api.spot(fadeID);
        },
        dist: (id) => {
          const batties = this.#batties;
          const total = batties.length;
          const coeff = api.pick(id);
          const co_html = coeff.innerHTML;
          api.spot(id).vaporize().during(0, 0.5).shrink().during(0.5);
          coeff.setAttribute("data-coeff", "");
          for (const [i, bat] of batties.entries()) {
            api
              .mount(
                `${coeff.id}-${bat.id}`,
                co_html + " <b data-middot></b>",
                "grow-term",
              )
              .insertBefore(bat.id)
              // .viva()
              .materialize()
              .during(0.5)
              .grow()
              // .during(0.6 + (i / total) * 0.4);
              .during(0.6);
            bat.innerHTML = `
             <b data-term>
              <b data-vaporize style="--ani-start:${0.25 + (i / total) * 0.4};--ani-end:${0.85 + (i / total) * 0.2}">${bat.innerText}</b>
              <b data-original>${bat.innerHTML}</b>
             </b>
            `;
          }
          return api.spot(id);
        },
        root: (id) => {
          const bat0 = this.#batties[0];
          id = id || `${this.#opts.fix}${crypto.randomUUID()}`;
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
          bat0.parentNode.insertBefore(rootEl, bat0);
          const termB = rootEl.querySelector("[data-root-terms]");
          for (const el of this.#batties) termB.append(el);
          return api.spot(id);
        },
        frak: (...ids) => {
          const bat0 = this.#batties[0];
          const frakID = `${bat0.id}-frak`;

          const frakEl = document.createElement("b");
          frakEl.innerHTML = `
           <b id="${frakID}" data-frak-anim>
            <b data-numerator id="${frakID}-num">
             <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path data-frak-anim-slash />
             </svg>
            </b>
            <b data-denominator id="${frakID}-den"></b>
           </b>
          `;
          bat0.parentNode.insertBefore(frakEl, bat0);
          const numer = frakEl.querySelector("[data-numerator]");
          const denom = frakEl.querySelector("[data-denominator]");
          for (const el of this.#batties) numer.append(el);
          for (const id of new Set(ids)) denom.append(api.pick(id));
          return api;
        },
        // #endregion

        // #region ATTEMPTS
        powerRule: () => {
          const batties = this.#batties;
          for (const bat of batties) {
            const sup = bat.querySelector("[data-sup]");
            if (!sup) return api;
            sup.remove();
            bat.innerHTML = `
              <b data-prx>
                <b id="baseXXX" data-prx-base>${bat.innerText}</b>
                <b data-sup data-prx-expo>
                  <b data-prx-org>
                    <b>${sup.innerText}</b>
                    <b data-grow>- 1</b>
                  </b>
                  <b id="dop" data-prx-dop>
                    <b>${sup.innerText}</b>
                    <b data-grow>&middot;</b>
                  </b>
                </b>
              </b>
            `;
            this.#measureElements(...bat.querySelectorAll("*"));
            const base = bat.querySelector("[data-prx-base]");
            const dop = bat.querySelector("[data-prx-dop]");
            api.spot("dop").moveBefore("baseXXX");
          }
          this.#batties = batties;
          return api;
        },
        // #endregion

        // #region !!! MORE TO DO !!!
        moreToDo: [
          "clone/dopple - copy immediately ontop of",
          "power rule - for derivate and integral",
          "redux - opposite of frak",
          "split - opposite of absorb",
          "faktor - opposite of distribute",
          "colorize - better css layout of coloring/filters",
          "cross-fade",
        ],
        // #endregion
      };

      return new Proxy(api, {
        set(target, prop, value) {
          throw new Error("API mutation not allowed");
        },
        defineProperty() {
          throw new Error("API mutation not allowed");
        },
        deleteProperty() {
          throw new Error("API mutation not allowed");
        },
        get(target, prop, receiver) {
          const val = Reflect.get(target, prop, receiver);
          return typeof val === "function" ? val.bind(target) : val;
        },
      });
    };

    async #runActs(step) {
      if (typeof step.acts !== "function") return { ok: true };

      const api = this.#makeAPI();

      try {
        const result = step.acts(api);
        const resolved = result?.then ? await result : result;
        if (resolved === false) {
          return { ok: false, reason: "explicit false return" };
        }
        return { ok: true, value: resolved };
      } catch (err) {
        return { ok: false, reason: err };
      }
    }

    async #processStep(step) {
      // TEST & STALL
      // await new Promise((r) => setTimeout(r, 800));

      // load new stage if needed
      step.load = step.load ? this.#strip(step.load) : this.#stageObj.innerHTML;

      // make the step tags
      const stepTag = this.#makeStepTag(step.load, step.note || "");

      // set the stage object
      this.#stageObj = stepTag.children[0];

      // append the steptags
      this.#holder.append(stepTag);

      // !!! layout HAKC - must be here for measuring !!!
      await new Promise((r) => requestAnimationFrame(r));

      // set measurements
      this.#measureElements(...this.#stageObj.querySelectorAll("*"));

      // try to run the acts
      const acted = await this.#runActs(step);

      // check if that werked
      if (!acted) return { ok: false, reason: acted };

      // copy the step tags for next time
      const nextStep = this.#makeTag("b", stepTag.innerHTML, "step");

      // remove absorbs from stage
      this.#removeAbsorbs(nextStep);

      // remove xfades from stage
      this.#removeXfades(nextStep);

      // remove distributions from stage
      this.#removeDists(nextStep);

      // reset the fraktions
      this.#resetFraks(nextStep);

      // remove the API <b>'s
      this.#removeAPIs(nextStep);

      // reset the stage to the cleaned version
      this.#stageObj = nextStep.children[0];

      // remove IDs [or make #namespaceIDs()]
      this.#removeIDs(stepTag.children[0]);

      // the tag is done with measurements
      stepTag.removeAttribute("data-measure");

      // let em know you're rockin
      dispatch(this.#holder, `${this.#opts.fix}-#${this.#currentStep}-ready`);

      // let the rez know
      return { ok: true };
    }

    async loadRoutine(routine = {}) {
      if (this.#isLoading) return { ok: false, reason: "already loading" };
      this.#isLoading = true;

      this.#holder.replaceChildren();
      this.#routine = routine;
      const routineNum = ++this.#routineNum;
      this.#currentStep = 0;

      if (routine.intro) {
        this.#holder.append(this.#saniTag("b", routine.intro, "intro"));
      }

      this.#stageObj = this.#saniTag("b", routine.stage, "stage");

      dispatch(this.#holder, `${this.#opts.fix}-routine-start`);

      for (const step of routine.steps || []) {
        if (routineNum !== this.#routineNum) break;

        const stepIndex = this.#currentStep++;
        const result = await this.#processStep(step);

        if (!result?.ok) {
          dispatch(this.#holder, `${this.#opts.fix}-routine-failed`);
          this.#isLoading = false;
          return { ok: false, step: stepIndex, reason: result?.reason };
        }
      }

      this.#isLoading = false;
      dispatch(this.#holder, `${this.#opts.fix}-routine-complete`);
      return { ok: true };
    }

    disconnect() {
      ++this.#routineNum;
      this.#holder?.replaceChildren();
      this.#holder = null;
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
      this.#opts = sieve(devOpts, parseData(this.dataset[devOpts.fix]));

      this.innerHTML = `<b data-holder style="--${devOpts.fix}-h:${this.#opts.color}"></b>`;

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
    try {
      const rez = await fetch(devOpts.css);
      if (!rez.ok) throw new Error("oops");

      const CSSText = await rez.text();
      const styleTag = document.createElement("style");

      styleTag.textContent = CSSText.replaceAll(
        defOpts.tag,
        devOpts.tag,
      ).replaceAll(defOpts.fix, devOpts.fix);

      document.head.appendChild(styleTag);
    } catch (err) {
      log(err, "what happened?");
    }

    // REGISTER TAG
    if (!customElements.get(devOpts.tag)) {
      customElements.define(devOpts.tag, MBX);
    }
  };

  doc.readyState === "loading"
    ? doc.addEventListener("DOMContentLoaded", boot)
    : boot();
  // #endregion
})(document, document.currentScript);
