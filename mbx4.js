((doc, script) => {
  // #region UTILS
  const log = console.log;

  const stall = (v = 800) => new Promise((r) => setTimeout(r, v));

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

  const raf = () => new Promise((r) => requestAnimationFrame(r));

  const swapElements = (a, b) => {
    if (!a || !b || a === b) return;
    const pa = a.parentNode;
    const pb = b.parentNode;
    if (!pa || !pb) return;

    const placeholder = document.createTextNode("");
    pa.replaceChild(placeholder, a);
    pb.replaceChild(a, b);
    pa.replaceChild(b, placeholder);
  };

  const camel = (s) => "un" + s[0].toUpperCase() + s.slice(1);

  // #endregion

  // #region OPTS
  const defOpts = {
    tag: "mathro-batix",
    fix: "mbx",
    css: "mbx4.css",
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
    #stepNum = 0;
    #stageObj = null;
    #batties = [];
    #allowed = new Set(["id"]);
    #SKILLS = [];
    #API = {};
    #short = {};
    #clean = [];
    #queue = Promise.resolve();
    #RO;
    #resizeFrames = new WeakMap();
    // #endregion

    constructor(holder, opts) {
      this.#opts = opts;
      this.#holder = holder;
      this.#SKILLS = [
        this.#makeFundamentals(),
        this.#makeSimpleShorts(),
        this.#makeDurationSkills(),
        this.#makeMoveSkills(),
        this.#makeWrapSkills(),
        this.#makeGroinkSkills(),
        this.#makeFunkSkills(),
        this.#makeJestSkills(),
        this.#makeRootSkills(),
        this.#makeFaxxSkills(),
        this.#makeRazeSkills(),
        this.#makeFrakSkills(),
        this.#makeExitSkills(),
        this.#makeFadeSkills(),
      ];
      this.#makeAPI_SHORT_CLEAN();
      this.#RO = this.#makeResizeObserver();
    }

    // #region SPOT UTILS
    #markup(html) {
      return html
        .trim()
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "> <")
        .replace(/([^\s])\^(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g, "$1<x data-sup>$2</x>")
        .replace(/([^\s])\_(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g, "$1<x data-sub>$2</x>")
        .replaceAll(
          "///",
          `
            <x data-inline-frak-holder>
             <x data-inline-frak>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
               <path data-frak-slash />
              </svg>
             </x>
            </x>
          `,
        );
    }

    #strip(html) {
      const markup = this.#markup(String(html));

      const tpl = document.createElement("template");
      tpl.innerHTML = markup;

      // strip whatever ...
      // this.#allowed ...

      const tmpX = document.createElement("x");
      tmpX.appendChild(tpl.content.cloneNode(true));
      return tmpX.innerHTML;
    }

    #makeTag(type, html = "", vals) {
      const tag = document.createElement(type);
      tag.innerHTML = this.#markup(html);
      if (vals) {
        for (const [key, value] of Object.entries(vals)) {
          if (key === "id") {
            tag.id = CSS.escape(value);
            continue;
          }
          /^--/.test(key)
            ? tag.style.setProperty(key, value)
            : tag.setAttribute(`data-${key}`, value);
        }
      }
      return tag;
    }

    #saniTag(type, html = "", vals) {
      return this.#makeTag(type, this.#strip(html), vals);
    }

    #makeStepTag(load, note) {
      const stepTag = this.#makeTag("x", "", { step: "" });
      const stage = this.#makeTag("x", load, { stage: "" });
      const comm = this.#makeTag("x", note, { comm: "" });
      stepTag.setAttribute("data-measure", "");
      stepTag.append(stage, comm);
      return stepTag;
    }

    #measureElements(...els) {
      const props = ["top", "left", "width", "height", "x", "y"];
      const unique = [...new Set(els)];
      const rects = unique.map((el) => ({
        el,
        rect: el.getBoundingClientRect(),
      }));

      for (const { el, rect } of rects) {
        const style = el.style;
        for (const prop of props) {
          style.setProperty(`--${this.#opts.fix}-${prop}`, Math.round(rect[prop]) + "px");
        }
      }
    }

    #removeIDs(stage) {
      for (const bat of stage.querySelectorAll("x[id]")) {
        bat.removeAttribute("id");
      }
    }

    #namespaceIDs(stage, fix, stepNum) {
      for (const bat of stage.querySelectorAll("[id]")) {
        bat.id = `${fix}-step-${stepNum}-${bat.id}`;
      }
    }

    #wrap(type, vals) {
      for (const bat of this.#batties) {
        let targ;
        if (bat.tagName === "path") {
          bat.setAttribute(`data-${type}`, "");
          targ = bat;
        } else {
          bat.innerHTML = `<x data-${type}>${bat.innerHTML}</x>`;
          targ = bat.children[0];
        }
        targ.setAttribute("data-source", bat.id);
        if (vals) {
          for (const [key, value] of Object.entries(vals)) {
            /^--/.test(key)
              ? targ.style.setProperty(key, value)
              : targ.setAttribute(`data-${key}`, value);
          }
        }
      }
      return this.#API;
    }

    #unWrap(type, stage) {
      for (const bat of stage.querySelectorAll(`[data-${type}]`)) {
        if (bat.tagName === "path") {
          bat.removeAttribute(`data-${type}`);
        } else {
          bat.replaceWith(...[...bat.childNodes]);
        }
      }
    }

    #unShort = (skill, bat) => {
      this.#batties = bat.children;
      this.#wrap(skill);
      return [...bat.children];
    };

    // #endregion

    // #region SKILLS
    #makeFundamentals() {
      return {
        api: {
          pick: (id) => {
            return this.#stageObj?.querySelector(`[id="${CSS.escape(id)}"]`) || null;
          },
          spot: (...ids) => {
            const unique = [...new Set(ids)];
            this.#batties = unique.map((id) => this.#API.pick(id)).filter((bat) => bat !== null);
            return this.#API;
          },
          spotAll: () => {
            this.#batties = [...this.#stageObj.querySelectorAll("*")];
            return this.#API;
          },
          spotStage: () => {
            this.#batties = [this.#stageObj];
            return this.#API;
          },
          mount: (id, html, vals) => {
            const bat = this.#makeTag("x", html, { ...vals, id });
            this.#stageObj?.append(bat);
            return this.#API.spot(bat.id);
          },
          dismount: () => {
            for (const bat of this.#batties) {
              bat.remove();
            }
            return this.#API;
          },
          team: (id, vals = {}) => {
            if (!id) return this.#API;
            const bats = this.#batties;
            const team = this.#makeTag("x", "", {
              team: "",
              id: id,
              ...vals,
            });
            bats[0].replaceWith(team);
            for (const bat of bats) {
              team.append(bat);
            }
            return this.#API.spot(id);
          },
          insertBefore: (id) => {
            const beef = this.#API.pick(id);
            if (!beef) return this.#API;
            for (const bat of this.#batties) {
              beef.parentNode.insertBefore(bat, beef);
            }
            return this.#API;
          },
          insertAfter: (id) => {
            const beef = this.#API.pick(id);
            if (!beef) return this.#API;
            for (const bat of this.#batties) {
              beef.parentNode.insertBefore(bat, beef.nextSibling);
            }
            return this.#API;
          },
          hide: () => {
            for (const bat of this.#batties) {
              bat.style.display = "none";
            }
            return this.#API;
          },
          show: () => {
            for (const bat of this.#batties) {
              bat.style.display = "revert";
            }
            return this.#API;
          },
          alter: (html) => {
            for (const bat of this.#batties) {
              bat.replaceWith(this.#makeTag("x", html));
            }
            return this.#API;
          },
          around: (v) => {
            for (const bat of this.#batties) {
              bat.children[0].style.setProperty("transform-origin", v);
            }
            return this.#API;
          },
          setColor: (v) => {
            for (const bat of this.#batties) {
              bat.style.setProperty("color", v);
            }
            return this.#API;
          },
          setFilter: (v) => {
            for (const bat of this.#batties) {
              bat.setAttribute("data-filter", v);
            }
            return this.#API;
          },
          setVar: (prop, val) => {
            for (const bat of this.#batties) {
              bat.children[0].style.setProperty(`--${this.#opts.fix}-${prop}`, val);
            }
            return this.#API;
          },
          doppel: (v) => {
            let val = Number(v);
            if (!Number.isInteger(val) || val < 1 || val >= 10) {
              val = 1;
            }
            for (const bat of this.#batties) {
              const holder = this.#makeTag("x", "", { doppel: "", source: bat.id });
              bat.replaceWith(holder);
              for (let i = 0; i < val; i++) {
                const dop = this.#makeTag("x", bat.innerHTML, {
                  id: `${bat.id}-doppel${val > 1 ? `-${i + 1}` : ""}`,
                });
                holder.append(dop);
              }
              holder.append(bat);
            }
            return this.#API;
          },
          unfurl: (s = 0, e = 1) => {
            const d = e - s;
            const batties = this.#batties;
            const total = batties.length;
            for (const [i, bat] of batties.entries()) {
              this.#API
                .spot(bat.id)
                .grow()
                .during(s + (i / total) * d, e);
            }
            this.#batties = batties;
            return this.#API;
          },
        },
      };
    }

    #makeSimpleShorts() {
      return {
        short: {
          "[data-vert]": (bat) => {
            bat.style.transform = `translateY(${bat.dataset.vert || 0})`;
            bat.removeAttribute("data-vert");
            return bat;
          },
          "[data-good]": (bat) => {
            bat.innerHTML = `
             <svg data-good-svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path />
             </svg>
            `;
          },
          "mbx-tite": (bat) => {
            const val = bat.getAttribute("val");
            return this.#makeTag("x", `<x data-tite>${bat.innerHTML}</x>`, {
              ...(val ? { [`--${this.#opts.fix}-tite-val`]: val } : {}),
              ...(bat.id ? { id: bat.id } : {}),
            });
          },
          "mbx-half": (bat) => {
            return this.#makeTag("x", `&frac12;`, {
              ...(bat.id ? { id: bat.id } : {}),
              half: "",
            });
          },
        },
      };
    }

    #makeDurationSkills() {
      return {
        api: {
          during: (val1, val2 = null) => {
            let start = val1;
            let end = val2;

            if (val1 != null && val2 != null) {
              start = Math.min(val1, val2);
              end = Math.max(val1, val2);
            }

            const s = start != null ? Math.max(0, Math.min(1, start)) : 0;
            const e = end != null ? Math.max(0, Math.min(1, end)) : 1;

            for (const bat of this.#batties) {
              if (bat.hasAttribute("data-move")) {
                bat.style.setProperty("--ani-start", s);
                bat.style.setProperty("--ani-end", e);
                const blanks = this.#stageObj.querySelectorAll(`[data-source="${bat.id}"]`);
                for (const blank of blanks) {
                  blank.style.setProperty("--ani-start", s);
                  blank.style.setProperty("--ani-end", e);
                }
                continue;
              }
              if (bat.hasAttribute("data-logged")) {
                bat.style.setProperty("--ani-start", s);
                bat.style.setProperty("--ani-end", e);
                const id = bat.getAttribute("data-logged");
                const open = this.#stageObj.querySelector(`[data-source="${id}-log-open"]`);
                const close = this.#stageObj.querySelector(`[data-source="${id}-log-close"]`);
                for (const log of [open, close]) {
                  log.style.setProperty("--ani-start", s);
                  log.style.setProperty("--ani-end", e);
                }
                // continue;
              }
              let fc = bat;
              if (bat.children[0]) {
                fc = bat.children[0].hasAttribute("data-grow") ? bat : bat.children[0];
              }

              fc.style.setProperty("--ani-start", s);
              fc.style.setProperty("--ani-end", e);
            }

            return this.#API;
          },
        },
        clean: [
          (stage) => {
            for (const bat of stage.querySelectorAll("[style]")) {
              bat.style.removeProperty("--ani-start");
              bat.style.removeProperty("--ani-end");
            }
          },
        ],
      };
    }

    #makeMoveBlank(type, prime) {
      // try using a stripped clone
      const clone = prime.cloneNode(true);
      for (const tuck of clone.querySelectorAll("[data-tuck], [data-vault], [data-spin]")) {
        tuck.replaceWith(...[...tuck.childNodes]);
      }

      // make blank with INVISIBLE text ... haaaakc!!!
      const blank = this.#makeTag("x", `<x>${clone.innerHTML}</x>`, {
        id: `${prime.id}-${type}-blank`,
        source: prime.id,
        blank: type,
      });

      // put the blank in the original spot
      prime.parentNode.insertBefore(blank, prime);

      const rect = blank.getBoundingClientRect();
      blank.style.setProperty("--blank-w", rect.width + "px");
      blank.style.setProperty("--blank-h", rect.height + "px");

      // store the prime mover inside the blank
      blank.append(prime);

      // remember the prime id
      prime.setAttribute("data-source", prime.id);
    }

    async #measureMovers(stage) {
      const all = stage.querySelectorAll(":not([data-move])");
      const movers = stage.querySelectorAll("[data-move]");
      const origBlanks = stage.querySelectorAll(`[data-blank="origin"]`);
      const destBlanks = stage.querySelectorAll(`[data-blank="destiny"]`);

      const orig = { blanks: new Map(), rects: new Map(), fonts: new Map() };
      const dest = { blanks: new Map(), rects: new Map(), fonts: new Map() };
      const anims = new Map();

      // sort blanks
      for (const blank of origBlanks) {
        const id = blank.getAttribute("data-source");
        orig.blanks.set(id, blank);
      }
      for (const blank of destBlanks) {
        const id = blank.getAttribute("data-source");
        dest.blanks.set(id, blank);
      }

      // get animations
      for (const one of all) {
        const animList = one.getAnimations();
        if (animList.length > 0) {
          anims.set(one, animList);
        }
      }

      // set to initial state
      for (const animList of anims.values()) {
        for (const anim of animList) {
          anim.pause();
          anim.currentTime = CSS.percent(0);
        }
      }

      // force layout HAKC !!!
      await raf();

      // set origin rects
      for (const [id, blank] of orig.blanks.entries()) {
        orig.rects.set(id, blank.getBoundingClientRect());
        orig.fonts.set(id, parseFloat(getComputedStyle(blank).fontSize));
      }

      // set all animations to final state
      for (const animList of anims.values()) {
        for (const anim of animList) {
          anim.currentTime = CSS.percent(100);
        }
      }

      // force layout HAKC !!!
      await raf();

      // set the destiny rects
      for (const [id, blank] of dest.blanks.entries()) {
        dest.rects.set(id, blank.getBoundingClientRect());
        dest.fonts.set(id, parseFloat(getComputedStyle(blank).fontSize));
      }

      // set the deltas for the move animation
      for (const prime of movers) {
        const id = prime.getAttribute("data-source");
        const SR = stage.getBoundingClientRect();
        const OR = orig.rects.get(id);
        const DR = dest.rects.get(id);

        const deltas = [
          // ["dx", OR.x - DR.x],
          // ["dy", OR.y - DR.y],
          ["old-top", OR.top - SR.top],
          ["new-top", DR.top - SR.top],
          ["old-left", OR.left - SR.left],
          ["new-left", DR.left - SR.left],
          ["old-wide", OR.width],
          ["new-wide", DR.width],
          ["old-high", OR.height],
          ["new-high", DR.height],
          ["old-font", orig.fonts.get(id)],
          ["new-font", dest.fonts.get(id)],
        ];

        for (const [key, val] of deltas) {
          prime.style.setProperty(`--${this.#opts.fix}-${key}`, `${val}px`);
        }
      }

      // restart animations
      for (const animList of anims.values()) {
        for (const anim of animList) {
          anim.play();
        }
      }
      return true;
    }

    #makeMoveSkills() {
      const move = (anchorID, direction) => {
        const anchor = this.#API.pick(anchorID);
        if (!anchor) return this.#API;

        const primeMovers = direction === "after" ? this.#batties.reverse() : this.#batties;

        for (const prime of primeMovers) {
          this.#makeMoveBlank("origin", prime);
          const ref = direction === "after" ? anchor.nextSibling : anchor;
          anchor.parentNode.insertBefore(prime, ref);
          this.#makeMoveBlank("destiny", prime);
          prime.setAttribute("data-move", "");
          this.#stageObj.append(prime);
        }

        this.#stageObj.setAttribute("data-resized", "0");
        this.#stageObj.setAttribute("data-stepNum", this.#stepNum);
        this.#RO.observe(this.#stageObj); // note: observe calls #measureMovers

        return this.#API;
      };

      return {
        api: {
          moveBefore: (id) => move(id, "before"),
          moveAfter: (id) => move(id, "after"),
        },
        clean: [
          (stage) => {
            for (const blank of stage.querySelectorAll(`[data-blank="destiny"]`)) {
              const id = blank.getAttribute("data-source");
              blank.children[0].id = id;
              blank.replaceWith(blank.children[0]);
            }
            for (const blank of stage.querySelectorAll("[data-blank]")) {
              blank.remove();
            }
            for (const mover of stage.querySelectorAll("[data-move]")) {
              mover.remove();
            }
          },
        ],
      };
    }

    #makeResizeObserver() {
      return new ResizeObserver((entries) => {
        for (const entry of entries) {
          const target = entry.target;
          let count = parseInt(target.getAttribute("data-resized")) || 0;

          if (count === 0) {
            // target.setAttribute("data-resized", 1);
            // continue;
          }

          target.setAttribute("data-resized", ++count);

          if (this.#resizeFrames.has(target)) {
            cancelAnimationFrame(this.#resizeFrames.get(target));
          }

          const frameId = requestAnimationFrame(() => {
            // log(count, target.id);
            this.#measureMovers(target);
            this.#resizeFrames.delete(target);
          });

          this.#resizeFrames.set(target, frameId);
        }
      });
    }

    #makeWrapSkills() {
      const skills = [
        "viva",
        "ghost",
        "vaporize",
        "materialize",
        "flash",
        "blink",
        "tuck",
        "vault",
        "spin",
        "bulk",
        "colorize",
        "clearFilter",
        "salute",
        "retreat",
      ];
      const permas = [];

      const api = {};
      const short = {};
      const clean = [];

      for (const skill of [...skills, ...permas]) {
        const fixy = `${this.#opts.fix}-${skill}`;
        api[skill] = (val) => this.#wrap(skill, { ...(val ? { [`--${fixy}-val`]: val } : {}) });
        short[fixy] = (bat) => this.#unShort(skill, bat);
        if (!permas.includes(skill)) clean.push((stage) => this.#unWrap(skill, stage));
      }

      return { api: api, short: short, clean: clean };
    }

    #makeGroinkSkills() {
      const groink = (dir, v) => {
        this.#wrap("grow", {
          grow: dir,
          ...(v && { [`--${this.#opts.fix}-grow-scale`]: v }),
        });
        for (const bat of this.#batties) {
          this.#measureElements(bat.children[0]);
          bat.innerHTML = `<x>${bat.innerHTML}</x>`;
        }
        return this.#API;
      };
      return {
        short: {},
        api: {
          grow: (v) => groink("fore", v),
          shrink: (v) => groink("back", v),
          foink: (v) => this.#wrap("foink", { ...(v ? { [`--${this.#opts.fix}-foink-val`]: v } : {}) }),
        },
        clean: [
          (stage) => {
            for (const bat of stage.querySelectorAll("[data-grow]")) {
              const val = bat.getAttribute("data-grow");
              if (val === "fore") this.#unWrap("grow", stage);
              else if (val === "back") {
                const sub = stage.querySelector(`#${bat.getAttribute("data-source")}`);
                bat.remove();
                sub.remove();
              }
            }
            for (const bat of stage.querySelectorAll("[data-foink]")) {
              const val = bat.style.getPropertyValue(`--${this.#opts.fix}-foink-val`);
              const src = bat.getAttribute("data-source");
              const top = stage.querySelector(`[id="${src}"]`);
              top.style.fontSize = val;
              this.#unWrap("foink", stage);
            }
          },
        ],
      };
    }

    #makeFunkSkills() {
      const skills = ["log", "ln", "W"];
      const invers = ["sin", "cos", "tan", "sec", "cos", "cot", "trig"];

      const api = {};
      const short = {};
      const clean = [];

      const makeHTML = {
        open: (id, skill, base) => {
          const type = invers.includes(skill) ? "data-sup" : "data-sub";
          const bTag = base ? `<x ${type}>${base}</x>` : "";
          return `
           <x id="${id}-${skill}-open-text">
             <x>
               <x data-funk-text="${skill}">${skill}</x>
               ${bTag}
             </x>
             <x style="margin: 0 -0.2em;">(</x>
           </x>
         `;
        },
        close: (id, skill) => {
          return `<x id="${id}-${skill}-close-text" data-parens-rite>)</x>`;
        },
      };

      for (const skill of [...skills, ...invers]) {
        const fixy = `${this.#opts.fix}-${skill}`;
        api[skill] = (base = null) => {
          const textIDs = [];
          for (const bat of this.#batties) {
            bat.setAttribute(`data-${skill}-funk`, bat.id);
            this.#API
              .mount(`${bat.id}-${skill}-open`, makeHTML.open(bat.id, skill, base))
              .grow()
              .insertBefore(bat.id);
            this.#API
              .mount(`${bat.id}-${skill}-close`, makeHTML.close(bat.id, skill))
              .grow()
              .insertAfter(bat.id);
            textIDs.push(`${bat.id}-${skill}-open-text`, `${bat.id}-${skill}-close-text`);
          }
          return this.#API.spot(...textIDs);
        };
        short[fixy] = (bat) => {
          bat.id ||= `${this.#opts.fix}-${crypto.randomUUID()}`;
          const base = bat.getAttribute("base");
          const tag = this.#makeTag("x", bat.innerHTML, {
            [`${skill}`]: "",
            id: bat.id,
          });
          this.#API
            .mount(`${bat.id}-${skill}-open`, makeHTML.open(bat.id, skill, base))
            .insertBefore(bat.id)
            .mount(`${bat.id}-${skill}-close`, makeHTML.close(bat.id, skill))
            .insertAfter(bat.id);
          return tag;
        };
      }

      return { api: api, short: short, clean: clean };
    }

    #makeJestSkills() {
      const skills = {
        draw: ["cank", "xout", "good"],
        clip: ["cirk", "brak"],
      };

      const makeHTML = {
        draw: (html, skill) => {
          return `
           <x data-${skill}-text>${html}</x>
           <svg data-${skill}-svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path data-main data-${skill} />
           </svg>
          `;
        },
        clip: (html, skill) => {
          const clipID = `${this.#opts.fix}-${crypto.randomUUID()}`;
          return `
           <x data-${skill}-text>${html}</x>
           <svg data-${skill}-svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <clipPath data-clip id="${clipID}"><path data-main data-${skill}/></clipPath>
            <path data-${skill}-base clip-path="url(#${clipID})" />
           </svg>
          `;
        },
      };

      const api = {};
      const short = {};
      const clean = [];

      for (const type of Object.keys(skills)) {
        for (const skill of skills[type]) {
          const fixy = `${this.#opts.fix}-${skill}`;
          api[skill] = (val) => {
            for (const bat of this.#batties) {
              const tag = this.#makeTag("x", makeHTML[type](bat.innerHTML, skill), {
                jest: "fore",
                [`${type}`]: "",
                ...(val && { [`--${fixy}-val`]: val }),
              });
              bat.innerHTML = `${tag.outerHTML}`;
            }
            return this.#API;
          };
          api[camel(skill)] = () => {
            for (const bat of this.#batties) {
              for (const jest of bat.querySelectorAll("[data-jest]")) {
                jest.setAttribute("data-jest", "back");
                if (type === "clip") {
                  const clip = jest.querySelector("[data-clip]");
                  clip.id = `${this.#opts.fix}-${crypto.randomUUID()}`;
                  jest
                    .querySelector(`[data-${skill}-base]`)
                    .setAttribute("clip-path", `url(#${clip.id})`);
                }
              }
            }
            return this.#API;
          };
          short[fixy] = (bat) => {
            const tag = this.#makeTag(
              "x",
              `<x data-jest>${makeHTML[type](bat.innerHTML, skill)}</x>`,
              {
                ...(bat.id ? { id: bat.id } : {}),
                ...(bat.getAttribute("val") ? { [`--${fixy}-val`]: bat.getAttribute("val") } : {}),
              },
            );

            if (type === "clip") {
              tag.querySelector(`[data-${skill}-base]`).setAttribute("clip-path", "");
            }
            return tag;
          };
        }
        clean.push((stage) => {
          for (const bat of stage.querySelectorAll(`[data-jest][data-${type}]`)) {
            const val = bat.getAttribute("data-jest");
            if (val === "fore") {
              bat.setAttribute("data-jest", "");
              bat.querySelector("svg > path")?.setAttribute("clip-path", "");
            } else if (val === "back") {
              const targ = bat.children[0];
              bat.replaceWith(...[...targ.childNodes]);
            }
            // else {
            // log("[[[cleaning jest with no value]]]");
            // }
          }
        });
      }

      return {
        short: short,
        api: api,
        clean: clean,
      };
    }

    #makeFrakSkills() {
      const skills = ["frak"];

      const makeHTML = {
        frak: (id) => {
          return `
           <x data-frak-holder>
            <x data-frak>
             <x data-numerator ${id ? `id="${id}-numerator"` : ""}></x>
             <x data-slash ${id ? `id="${id}-slash"` : ""}>
              <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
               <path ${id ? `id="${id}-slash-path"` : ""}   />
              </svg>
             </x>
             <x data-denominator ${id ? `id="${id}-denominator"` : ""}></x>
            </x>
           </x>
          `;
        },
      };

      const api = {};
      const short = {};
      const clean = [];

      for (const skill of skills) {
        const fixy = `${this.#opts.fix}-${skill}`;
        api[skill] = (...ids) => {
          const bat0 = this.#batties[0];
          const ID = `${bat0.id}-${skill}`;
          const top = this.#makeTag("x", makeHTML[skill](ID), { id: ID });
          const guy = top.querySelector(`[data-${skill}]`);
          guy.setAttribute(`data-${skill}`, "fore");
          const [num, slash, den] = guy.children;
          bat0.parentNode.insertBefore(top, bat0);
          for (const bat of this.#batties) num.append(bat);
          for (const id of new Set(ids)) den.append(this.#API.pick(id));
          return this.#API.spot(ID);
        };
        api[camel(skill)] = () => {
          for (const bat of this.#batties) {
            const guy = bat?.children[0]?.children[0];
            if (!guy) continue;
            guy.setAttribute(`data-${skill}`, "back");
          }
          return this.#API;
        };
        short[fixy] = (bat) => {
          if (bat.children.length !== 2) return;
          const [orgNum, orgDen] = bat.children;
          const top = this.#makeTag("x", makeHTML[skill](bat?.id), {
            ...(bat.id ? { id: bat.id } : {}),
          });
          const guy = top.querySelector(`[data-${skill}]`);
          guy.children[0].append(orgNum);
          guy.children[2].append(orgDen);
          return top;
        };
        clean.push((stage) => {
          for (const bat of stage.querySelectorAll(
            `[data-${skill}="fore"], [data-${skill}="back"]`,
          )) {
            const val = bat.getAttribute(`data-${skill}`);
            if (val === "fore") {
              bat.setAttribute(`data-${skill}`, "");
            } else if (val === "back") {
              const top = bat?.parentNode?.parentNode;
              const num = bat?.children?.[0];
              if (!top || !num) continue;
              top.replaceWith(...[...num.childNodes]);
            }
          }
        });
      }

      api["ciprokate"] = (dir = 1) => {
        const batties = this.#batties;
        this.#API.spin(`${180 * dir}deg`);
        for (const bat of batties) {
          bat.setAttribute("data-ciprokate", "");
          const [num, den] = bat.querySelectorAll("[data-numerator], [data-denominator]");
          this.#batties = [num, den];
          this.#API.spin(`${-180 * dir}deg`);
        }
        this.#batties = batties;
        return this.#API;
      };
      clean.push((stage) => {
        for (const bat of stage.querySelectorAll("[data-ciprokate]")) {
          const [num, den] = bat.querySelectorAll("[data-numerator], [data-denominator]");
          num.removeAttribute("data-numerator");
          num.setAttribute("data-denominator", "");
          den.removeAttribute("data-denominator");
          den.setAttribute("data-numerator", "");
          swapElements(num, den);
          bat.removeAttribute("data-ciprokate");
        }
      });

      api["inlineFrak"] = () => {
        for (const bat of this.#batties) {
          const [num, den] = bat.querySelectorAll("[data-numerator], [data-denominator]");
          if (!num || !den) continue;
          log(num, den);
        }
      };
      return { api: api, short: short, clean: clean };
    }

    #makeRootSkills() {
      const skills = ["root"];

      const api = {};
      const short = {};
      const clean = [];

      api["root"] = (base = null) => {
        const bat0 = this.#batties[0];
        const id = `${bat0.id}-root`;
        const holder = this.#makeTag("x", "", {
          id: `${id}-holder`,
          source: id,
          ["root-holder"]: "",
        });
        const root = this.#makeTag("x", "", {
          id: CSS.escape(id),
          root: "fore",
        });
        const terms = this.#makeTag("x", "", {
          source: id, 
          ["root-terms"]: "",
        });
        const lines = this.#makeTag(
          "x",
          `
            <svg data-front-svg viewBox="0 0 24 100" preserveAspectRatio="none" aria-hidden="true">
             <path/>
            </svg>
            <svg data-top-svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
             <path/>
            </svg>
          `,
          {
            ["root-lines"]: "",
            source: id,
          },
        );
        const order = this.#makeTag("x", base||"", {
          ["root-order"]: "",
          source: id,
        });
        root.append(lines, terms);
        if (base) root.append(order);
        holder.append(root);
        bat0.replaceWith(holder);
        for (const el of this.#batties) {
          terms.append(el);
        }
        return this.#API.spot(id);
      };
      api["unRoot"] = () => {
        for (const bat of this.#batties) {
          bat.setAttribute("data-root", "back");
        }
      };
      clean.push((stage) => {
        for (const bat of stage.querySelectorAll("[data-root]")) {
          const val = bat.getAttribute("data-root");
          if (val) {
            bat.setAttribute("data-root", "");
          }
        }
      });

      return { api: api, short: short, clean: clean };
    }

    #makeFaxxSkills() {
      const api = {};
      const short = {};
      const clean = [];

      api["faxx"] = (id) => {
        // only one faxx box at a time
        const bat = this.#batties[0];
        const box = this.#stageObj.querySelector(`#${CSS.escape(id)}`);
        if (!bat || !box) return;
        const fax = this.#makeTag("x", "", { id: `${bat.id}-faxx`, faxx: "fore" });
        bat.replaceWith(fax);
        fax.append(bat, box);
        const batWide = bat.getBoundingClientRect().width;
        const boxWide = box.getBoundingClientRect().width;
        fax.style.setProperty(`--${this.#opts.fix}-start-wide`, batWide + "px");
        fax.style.setProperty(`--${this.#opts.fix}-end-wide`, Math.max(batWide, boxWide) + "px");
        this.#API.spot(bat.id).ghost().spot(box.id).viva().salute();

        return this.#API.spot(fax.id);
      };
      api[camel("faxx")] = () => {
        for (const fax of this.#batties) {
          fax.setAttribute("data-faxx", "back");
          const [bat, box] = fax.children;
          if (!bat || !box) continue;
          const batWide = bat.getBoundingClientRect().width;
          const boxWide = box.getBoundingClientRect().width;
          fax.style.setProperty(`--${this.#opts.fix}-start-wide`, batWide + "px");
          fax.style.setProperty(`--${this.#opts.fix}-end-wide`, Math.max(batWide, boxWide) + "px");
          this.#API.spot(bat.id).setFilter("ghost").clearFilter();
          this.#API.spot(box.id).retreat();
        }
        return this.#API;
      };
      clean.push((stage) => {
        for (const bat of stage.querySelectorAll("[data-faxx]")) {
          const val = bat.getAttribute("data-faxx");
          if (val === "fore") {
            bat.setAttribute("data-faxx", "");
          } else if (val === "back") {
            bat.children[0].style.textShadow = "none";
            bat.children[0].style.color = "inherit";
            bat.replaceWith(bat.children[0]);
          }
        }
      });

      return { api: api, short: short, clean: clean };
    }

    #makeRazeSkills() {
      const skills = ["raze"];

      const api = {};
      const short = {};
      const clean = [];

      for (const skill of skills) {
        api[skill] = (id, html) => {
          this.#API.team(`${id}-${skill}`, { [`${skill}`]: "fore" });
          this.#API.mount(id, html).insertBefore(`${id}-${skill}`).grow();
          return this.#API;
        };
        api[camel(skill)] = () => {
          for (const bat of this.#batties) {
            bat.setAttribute(`data-${skill}`, "back");
          }
          return this.#API;
        };
        clean.push((stage) => {
          for (const bat of stage.querySelectorAll(`[data-${skill}="fore"]`)) {
            bat.removeAttribute(`data-${skill}`);
            bat.setAttribute("data-sup", "");
          }
          for (const bat of stage.querySelectorAll(`[data-${skill}="back"]`)) {
            bat.removeAttribute(`data-${skill}`);
            bat.removeAttribute("data-sup");
          }
        });
      }

      return { api: api, short: short, clean: clean };
    }

    #makeExitSkills() {
      const skills = ["wink", "fliz"];

      const api = {};
      const short = {};
      const clean = [];

      for (const skill of skills) {
        const fixy = `${this.#opts.fix}-${skill}`;
        api[skill] = (val = 1000) => {
          const batties = this.#batties;
          for (const bat of this.#batties) {
            let targ;
            if (bat.tagName === "path") {
              bat.parentNode.setAttribute("data-exit", "");
              targ = bat.parentNode;
            } else {
              this.#API.spot(bat.id);
              this.#wrap("exit");
              targ = bat.children[0];
            }
            bat.style.setProperty(`--${fixy}-val`, `${val}ms`);
            const anim = targ.getAnimations()?.[0];
            if (!anim) continue;
            anim.onfinish = (e) => {
              bat.classList.add(fixy);
              setTimeout(() => bat.classList.remove(fixy), val);
            };
          }
          this.#batties = batties;
          return this.#API;
        };
      }

      return {
        api: api,
        short: short,
        clean: clean,
      };
    }

    #makeFadeSkills() {
      const skills = ["xfade", "absorb"];

      const api = {};
      const short = {};
      const clean = [];

      const handle = (skill, ids) => {
        const batties = this.#batties;
        const bat0 = batties[0];
        const ID = `${ids[0]}-${skill}`;

        this.#API.mount(ID, "<x></x><x></x>");

        this.#wrap(skill);

        const EL = this.#API.pick(ID);

        const [org, dop] = EL.children[0].children;

        bat0.parentNode.insertBefore(EL, bat0);

        for (const bat of batties) org.appendChild(bat);
        for (const id of ids) dop.appendChild(this.#API.pick(id));

        this.#measureElements(...EL.children[0].children);

        for (const [key, val] of Object.entries({ org: org, dop: dop })) {
          EL.children[0].style.setProperty(
            `--${this.#opts.fix}-xfade-wide-${key}`,
            `${Math.round(val.getBoundingClientRect().width)}px`,
          );
        }

        return this.#API.spot(ID);
      };

      for (const skill of skills) {
        const fixy = `${this.#opts.fix}-${skill}`;
        api[skill] = (...ids) => handle(skill, [...new Set(ids)]);
        short[fixy] = (bat) => this.#unShort(skill, bat);
        clean.push((stage) => {
          for (const bat of stage.querySelectorAll(`[data-${skill}]`)) {
            bat.parentNode.replaceWith(...[...bat.children[1].childNodes]);
          }
        });
      }

      return { api: api, short: short, clean: clean };
    }
    // #endregion

    // #region API SHORT & CLEAN
    #makeAPI_SHORT_CLEAN() {
      const api = {};
      const short = {};
      const clean = [];

      for (const skill of this.#SKILLS) {
        if (skill.api) Object.assign(api, skill.api);
        if (skill.short) Object.assign(short, skill.short);
        if (skill.clean) clean.push(...skill.clean);
      }

      this.#API = new Proxy(api, {
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

      this.#short = short;
      this.#clean = clean;
    }

    #replaceShorthands(stage) {
      for (const [key, val] of Object.entries(this.#short)) {
        for (const bat of stage.querySelectorAll(key)) {
          const rez = val(bat);
          if (rez) bat.replaceWith(...[rez].flat());
        }
      }
    }

    #runCleanups(stage) {
      for (const val of this.#clean) val(stage);
    }
    // #endregion

    // #region ROUTINE METHS
    async #runActs(step) {
      if (typeof step.acts !== "function") return { ok: true };

      try {
        const result = step.acts(this.#API);
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
      // !!! TESTING STALL !!!
      // await stall(1000);

      // load new stage if needed
      step.load ||= this.#stageObj.innerHTML;

      // make the step tags
      const stepTag = this.#makeStepTag(step.load, step.note || "");

      // step measuring
      stepTag.setAttribute("data-measure", "");

      // set the stage object
      this.#stageObj = stepTag.children[0];

      // replace shorthands
      this.#replaceShorthands(this.#stageObj);

      // append the steptags
      this.#holder.append(stepTag);

      // try to run the acts
      const acted = await this.#runActs(step);

      // check if that werked
      if (!acted) return { ok: false, reason: acted };

      // copy the step tags for next time
      const nextStep = this.#makeTag("x", stepTag.innerHTML, { step: "" });

      // run cleanups
      this.#runCleanups(nextStep);

      // reset the stage to the cleaned version
      this.#stageObj = nextStep.children[0];

      // remove IDs [or make #namespaceIDs()]
      this.#removeIDs(stepTag.children[0]);
      // this.#namespaceIDs(stepTag.children[0], this.#opts.fix, this.#stepNum);

      // the tag is done with measurements
      stepTag.removeAttribute("data-measure");

      // let em know you're rockin
      dispatch(this.#holder, `${this.#opts.fix}-#${this.#stepNum}-ready`);

      // let the rez know
      return { ok: true };
    }

    async loadRoutine(routine = {}) {
      if (this.#isLoading) return { ok: false, reason: "already loading" };
      this.#isLoading = true;

      this.#holder.replaceChildren();
      this.#routine = routine;
      const routineNum = ++this.#routineNum;
      this.#stepNum = 0;

      if (routine.intro) {
        this.#holder.append(this.#saniTag("x", routine.intro, { intro: "" }));
      }

      // this.#stageObj = this.#saniTag("x", routine.stage, { stage: "" });
      this.#stageObj = this.#makeTag("x", routine.stage, { stage: "" });

      dispatch(this.#holder, `${this.#opts.fix}-routine-start`);

      for (const step of routine.steps || []) {
        if (routineNum !== this.#routineNum) break;

        const stepIndex = this.#stepNum++;
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
    // #endregion

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

      this.innerHTML = `<x data-holder style="--${devOpts.fix}-h:${this.#opts.color}"></x>`;

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

      styleTag.textContent = CSSText.replaceAll(defOpts.tag, devOpts.tag).replaceAll(
        defOpts.fix,
        devOpts.fix,
      );

      document.head.appendChild(styleTag);
    } catch (err) {
      log(err, "what happened?");
    }

    // REGISTER TAG
    if (!customElements.get(devOpts.tag)) {
      customElements.define(devOpts.tag, MBX);
    }
  };

  doc.readyState === "loading" ? doc.addEventListener("DOMContentLoaded", boot) : boot();
  // #endregion
})(document, document.currentScript);
