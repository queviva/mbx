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
    css: "mbx5.css",
    color: 33,
    timeout: 5000,
  };

  const devOpts = sieve(defOpts, parseData(script.dataset[defOpts.fix]));
  // #endregion

  // #region BATTIES
  class Batties {
    constructor(arr = []) {
      const target = Array.isArray(arr) ? arr : [];
      return new Proxy(target, {
        get: (t, p) =>
          p === "replaceWith"
            ? (n) => Array.isArray(n) && ((t.length = 0), t.push(...n))
            : typeof t[p] === "function"
              ? t[p].bind(t)
              : t[p],
      });
    }
  }
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
    #battiesInstance = new Batties([]);
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
        this.#makeDurationSkills(),
        this.#makeWrapSkills(),
        this.#makeMoveSkills(),
        this.#makeGrowSkills(),
        // ... other omitted #makeSkills(),
      ];
      this.#makeAPI_SHORT_CLEAN();
      // this.#RO = this.#makeResizeObserver();
      window.addEventListener("orientationchange", (e) => {
        log("change orientals");
      });
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
          // style.setProperty(`--${this.#opts.fix}-${prop}`, Math.round(rect[prop]) + "px");
          style.setProperty(`--${this.#opts.fix}-${prop}`, rect[prop] + "px");
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

    #wrap(batties, skill, vals) {
      for (const bat of batties) {
        let targ;
        if (bat.tagName === "path") {
          bat.setAttribute(`data-${skill}`, "");
          targ = bat;
        } else {
          bat.innerHTML = `<x data-${skill}>${bat.innerHTML}</x>`;
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
    }

    #unWrap(stage, skill) {
      for (const bat of stage.querySelectorAll(`[data-${skill}]`)) {
        if (bat.tagName === "path") {
          bat.removeAttribute(`data-${skill}`);
        } else {
          bat.replaceWith(...[...bat.childNodes]);
        }
      }
    }

    #unShort (skill, bat) {
      this.#wrap([bat], skill);
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
            const unique = [...new Set(ids)].filter((id) => id != null && id !== "");
            this.#batties = unique.map((id) => this.#API.pick(id)).filter((bat) => bat !== null);
            return this.#API;
          },
          spotAll: () => {
            this.#batties = this.#stageObj ? [...this.#stageObj.querySelectorAll("*")] : [];
            return this.#API;
          },
          spotStage: () => {
            this.#batties = this.#stageObj ? [this.#stageObj] : [];
            return this.#API;
          },
          mount: (id, html, vals = {}) => {
            // const bat = this.#saniTag("x", html, { ...vals, id: CSS.escape(id) });
            const bat = this.#makeTag("x", html, { ...vals, id: CSS.escape(id) });
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
            if (!id || !this.#batties.length) return this.#API;
            id = CSS.escape(id);
            const team = this.#makeTag("x", "", { team: "", id, ...vals });
            const batties = this.#batties;
            batties[0].replaceWith(team);
            for (const bat of batties) {
              team.append(bat);
            }
            return this.#API.spot(id);
          },
          insert: (id, dir) => {
            const beef = this.#API.pick(id);
            if (!beef || !beef.parentNode) return this.#API;
            for (const bat of this.#batties) {
              beef.parentNode.insertBefore(bat, dir === "before" ? beef : beef.nextSibling);
            }
            return this.#API;
          },
          insertBefore: (id) => {
            this.#API.insert(id, "before");
          },
          insertAfter: (id) => {
            this.#API.insert(id, "after");
          },
          hide: () => {
            for (const bat of this.#batties) {
              bat.style.display = "none";
            }
            return this.#API;
          },
          show: () => {
            for (const bat of this.#batties) {
              bat.style.display = "";
            }
            return this.#API;
          },
          alter: (html) => {
            for (const bat of this.#batties) {
              const clone = bat.cloneNode(false);
              clone.innerHTML = html;
              bat.replaceWith(clone);
            }
            return this.#API;
          },
          around: (v) => {
            for (const bat of this.#batties) {
              bat?.children[0]?.style.setProperty("transform-origin", v);
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
          setProp: (prop, vals = {}) => {
            for (const bat of this.#batties) {
              for (const [key, value] of Object.entries(vals)) {
                bat.style.setProperty(key, value);
              }
            }
            return this.#API;
          },
          doppel: (v) => {
            let val = Number(v);
            if (!Number.isInteger(val) || val < 1 || val >= 10) {
              val = 1;
            }
            for (const bat of this.#batties) {
              const holder = this.#makeTag("x", "", {
                id: `${bat.id}-doppel`,
                doppel: "",
                source: bat.id,
              });
              bat.replaceWith(holder);
              for (let i = 0; i < val; i++) {
                const dop = this.#makeTag("x", bat.innerHTML, {
                  id: `${bat.id}-doppel-${i}`,
                  source: bat.id,
                });
                holder.append(dop);
              }
              holder.append(bat);
            }
            return this.#API;
          },
          unfurl: (s = 0, e = 1) => {
            const duration = e - s;
            if (duration <= 0) return this.#API;

            const batties = this.#batties;
            const total = batties.length;
            for (const [i, bat] of batties.entries()) {
              const start = s + (i / total) * duration;
              this.#API.spot(bat.id).grow().during(start, e);
            }
            this.#batties = batties;
            return this.#API;
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
              if (bat.hasAttribute("data-funk")) {
                bat.style.setProperty("--ani-start", s);
                bat.style.setProperty("--ani-end", e);
                const id = bat.getAttribute("data-funk");
                const open = this.#stageObj.querySelector(`[data-funk-open][data-source="${id}"]`);
                const close = this.#stageObj.querySelector(
                  `[data-funk-close][data-source="${id}"]`,
                );
                for (const log of [open, close]) {
                  log.style.setProperty("--ani-start", s);
                  log.style.setProperty("--ani-end", e);
                }
                // continue;
              }
              if (bat.hasAttribute("data-grow-holder")) {
                bat.style.setProperty("--ani-start", s);
                bat.style.setProperty("--ani-end", e);
                continue;
              }
              if (bat.hasAttribute("data-faxx")) {
                for (const child of bat.children) {
                  child.style.setProperty("--ani-start", s);
                  child.style.setProperty("--ani-end", e);
                }
                continue;
              }
              let fc = bat;
              if (bat.children[0]) {
                fc = bat.children[0];
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

    #makeWrapSkills() {
      const skills = [
        "viva",
        "ghost",
        "vaporize",
        "materialize",
        "blur",
        "flash",
        "blink",
        "tuck",
        "vault",
        "spin",
        "bulk",
        "clearFilter",
        "salute",
        "retreat",
      ];
      const permas = new Map([
        ["foink", "font-size"],
        ["colorize", "color"],
        ["vert", "translate"],
      ]);

      const api = {};
      const short = {};
      const clean = [];

      for (const skill of [...skills, ...permas.keys()]) {
        const fixy = `${this.#opts.fix}-${skill}`;
        api[skill] = (val) => {
          this.#wrap(this.#batties, skill, { ...(val ? { [`--${fixy}-val`]: val } : {}) });
          return this.#API;
        };
        short[fixy] = (bat) => this.#unShort(skill, bat);
        if (!permas.has(skill)) {
          clean.push((stage) => this.#unWrap(stage, skill));
        } else {
          clean.push((stage) => {
            for (const bat of stage.querySelectorAll(`[data-${skill}]`)) {
              const top = stage.querySelector(`#${bat.getAttribute("data-source")}`);
              const sty = getComputedStyle(bat);
              top.style.setProperty(
                permas.get(skill),
                (skill === "vert" ? "0 " : "") + sty.getPropertyValue(`--${fixy}-val`),
              );
            }
            this.#unWrap(stage, skill);
          });
        }
      }

      return { api: api, short: short, clean: clean };
    }

    #makeGrowSkills() {
      const skills = ["grow"];
      const api = {};
      const short = {};
      const clean = [];

      const groink = (vals = {}, skill, dir = "fore") => {
        this.#wrap(this.#batties, skill, { ...(vals ? vals : {}), [`${skill}`]: dir });
        for (const bat of this.#batties) {
          bat.setAttribute(`data-${skill}-holder`, dir);
          // this.#measureElements(bat.children[0]);
        }
        return this.#API;
      };

      for (const skill of skills) {
        const fixy = `${this.#opts.fix}-${skill}`;
        api[skill] = (vals) => groink(vals, skill, "fore");
        api[camel(skill)] = (vals) => groink(vals, skill, "back");
        short[fixy] = (bat) => {
          const val = bat.getAttribute("val");
          return this.#makeTag("x", `<x data-${skill}-holder="fore"><x data-${skill}>${bat.innerHTML}</x></x>`, {
            ...(val ? { [`--${fixy}-val`]: val } : {}),
            ...(bat.id ? { id: bat.id } : {}),
          });
        };
        clean.push((stage) => {
          for (const bat of stage.querySelectorAll(`[data-${skill}-holder]`)) {
            const val = bat.getAttribute(`data-${skill}-holder`);
            if (val === "fore") {
              this.#unWrap(stage, `${skill}`);
              bat.removeAttribute(`data-${skill}-holder`);
            } else if (val === "back") {
              log("removing bat", bat.id);
              bat.remove();
            }
            // this.#unWrap(stage, skill);
          }
        });
      }

      return { api: api, short: short, clean: clean };
    }

    #makeMoveBlank(type, prime) {
      // try using a stripped clone
      const clone = prime.cloneNode(true);
      for (const tuck of clone.querySelectorAll("[data-tuck], [data-vault], [data-spin]")) {
        tuck.replaceWith(...[...tuck.childNodes]);
      }

      // make blank with INVISIBLE text ... haaaakc!!!
      const blank = this.#makeTag("x", `<x data-blank="${type==="origin"?"back":"fore"}">${clone.innerHTML}</x>`, {
        id: `${prime.id}-${type}-blank`,
        source: prime.id,
        blank: type,
        "blank-holder": type === "origin" ? "back" : "fore"
      });

      // put the blank in the original spot
      prime.parentNode.insertBefore(blank, prime);

      // store the prime mover inside the blank
      blank.append(prime);

      // remember the prime id
      prime.setAttribute("data-source", prime.id);
    }

    async #measureMovers(stage) {
      const orig = { blanks: new Map(), rects: new Map(), fonts: new Map() };
      const dest = { blanks: new Map(), rects: new Map(), fonts: new Map() };
      const anims = new Map();

      const all = stage.querySelectorAll("*");
      const origBlanks = stage.querySelectorAll(`[data-blank="origin"]`);
      const destBlanks = stage.querySelectorAll(`[data-blank="destiny"]`);

      const movers = new Map(
        Array.from(stage.querySelectorAll("[data-move]"), (bat) => [
          bat.getAttribute("data-source"),
          bat,
        ]),
      );

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
        // this.#measureElements(blank);
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
        // this.#measureElements(blank);
      }
      // set the deltas for the move animation (relative to dest mover)
      for (const [id, prime] of movers.entries()) {
        const OR = orig.rects.get(id);
        const DR = dest.rects.get(id);

        const deltas = [
          // positions: start at dest (0,0) and move to orig
          ["old-top", OR.top - DR.top],
          ["new-top", 0],
          ["old-left", 0],//OR.left - DR.left - OR.width - 6],
          ["new-left", 0],

          // sizes: start at dest size and animate to orig size
          ["old-wide", OR.width],
          ["new-wide", DR.width],
          ["old-high", OR.height],
          ["new-high", DR.height],

          // fonts: start at dest font and animate to orig font
          ["old-font", orig.fonts.get(id)],
          ["new-font", dest.fonts.get(id)],
        ];

        // actually set the values
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
        }
        this.#measureMovers(this.#stageObj);

        this.#stageObj.setAttribute("data-resized", "0");
        this.#stageObj.setAttribute("data-stepNum", this.#stepNum);
        // this.#RO.observe(this.#stageObj); // note: observe calls #measureMovers
        // this.#measureMovers(this.#stageObj);

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

    // ... other omitted #makeSkills(){}

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

      // make step stage and note tags
      const stepTag = this.#makeStepTag(step.load, step.note || "");

      // set the stage object
      this.#stageObj = stepTag.children[0];

      // replace shorthands
      this.#replaceShorthands(this.#stageObj);

      // append steptags in data-measure mode
      this.#holder.append(stepTag);

      // try to run the acts
      const acted = await this.#runActs(step);

      // check if that werked
      if (!acted) return { ok: false, reason: acted };

      // copy the step tags for next time
      const nextStep = this.#makeTag("x", stepTag.innerHTML, { step: "" });

      // step tags done with measurements
      stepTag.removeAttribute("data-measure");

      // remove IDs || [make namespace IDs]
      // this.#removeIDs(stepTag.children[0]);
      this.#namespaceIDs(stepTag.children[0], this.#opts.fix, this.#stepNum);

      // run cleanups
      this.#runCleanups(nextStep);

      // reset the stage to the cleaned version
      this.#stageObj = nextStep.children[0];

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
      log("what happened?", err);
    }

    // REGISTER TAG
    if (!customElements.get(devOpts.tag)) {
      customElements.define(devOpts.tag, MBX);
    }
  };

  doc.readyState === "loading" ? doc.addEventListener("DOMContentLoaded", boot) : boot();
  // #endregion
})(document, document.currentScript);
