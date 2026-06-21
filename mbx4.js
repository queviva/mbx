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
        this.#makeJestorSkills(),
        this.#makeExitSkills(),
        this.#makeFadeSkills(),
      ];

      this.#makeAPI_SHORT_CLEAN();
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

    #makeTag(type, html, vals) {
      const tag = document.createElement(type);
      tag.innerHTML = this.#markup(html);
      if (vals) {
        for (const [key, value] of Object.entries(vals)) {
          /^--/.test(key)
            ? tag.style.setProperty(key, value)
            : tag.setAttribute(`data-${key}`, value);
        }
      }
      return tag;
    }

    #saniTag(type, html, vals) {
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
            const bat = this.#makeTag("x", html, vals);
            bat.id = CSS.escape(id);
            this.#stageObj?.append(bat);
            return this.#API.spot(bat.id);
          },
          dismount: () => {
            for (const bat of this.#batties) {
              bat.remove();
            }
            return this.#API;
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
              bat.replaceChildren(this.#strip(html));
            }
            return this.#API;
          },
          around: (v) => {
            for (const bat of this.#batties) {
              bat.children[0].style.setProperty("transform-origin", v);
            }
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
          "mbx-tite": (bat) => {
            const val = bat.getAttribute("val");
            const tite = this.#makeTag(
              "x",
              `<x data-tite>${bat.innerHTML}</x>`,
              !val || { [`--${this.#opts.fix}-tite-val`]: val },
            );
            if (bat.id) tite.id = bat.id;
            return tite;
          },
        },
      };
    }

    #makeDurationSkills() {
      return {
        api: {
          during: (start, end = null) => {
            const s = start != null ? Math.max(0, Math.min(1, start)) : null;
            const e = end != null ? Math.max(0, Math.min(1, end)) : null;

            for (const bat of this.#batties) {
              let fc;
              if (bat.children[0].hasAttribute("data-grow")) {
                fc = bat;
              } else {
                fc = bat.children[0];
              }
              if (start != null) fc.style.setProperty("--ani-start", start);
              if (end != null) fc.style.setProperty("--ani-end", end);
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

    #makeMoveSkills() {
      const move = (anchorID, direction) => {
        const anchor = this.#API.pick(anchorID);
        if (!anchor) return this.#API;
        const allBats = Array.from(this.#stageObj.querySelectorAll("*"));

        const snapshots = new Map();
        for (const [i, bat] of allBats.entries()) {
          bat.id ||= `${this.#opts.fix}-${i}`;
          snapshots.set(bat.id, bat.getBoundingClientRect());
          bat.oldFont = getComputedStyle(bat).fontSize;
        }

        const blanks = [];
        for (const bat of allBats) {
          const rect = snapshots.get(bat.id);
          const blank = bat.cloneNode(false);
          // blank.setAttribute("data-blank", "");
          blank.style.setProperty("--blank-w", Math.round(rect.width) + "px");
          blank.style.setProperty("--blank-h", Math.round(rect.height) + "px");
          blank.removeAttribute("id");
          // bat.parentNode.insertBefore(blank, bat.nextSibling);
          blanks.push(blank);
        }

        const batsArray =
          direction === "after" ? Array.from(this.#batties).reverse() : Array.from(this.#batties);

        for (const bat of batsArray) {
          const ref = direction === "after" ? anchor.nextSibling : anchor;
          anchor.parentNode.insertBefore(bat, ref);
        }

        for (const bat of allBats) {
          const oldRect = snapshots.get(bat.id);
          const newRect = bat.getBoundingClientRect();

          const dx = oldRect.left - newRect.left;
          const dy = oldRect.top - newRect.top;

          bat.newFont = getComputedStyle(bat).fontSize;

          const deltas = new Map([
            ["dx", `${Math.round(dx)}px`],
            ["dy", `${Math.round(dy)}px`],
            ["old-font", bat.oldFont],
            ["new-font", bat.newFont],
          ]);

          bat.innerHTML = `<x data-move>${bat.innerHTML}</x>`;
          const wrap = bat.children[0];

          wrap.setAttribute("data-move", "");

          for (const [key, val] of deltas) {
            wrap.style.setProperty(`--${this.#opts.fix}-${key}`, val);
          }
        }

        return this.#API;
      };

      return {
        api: {
          moveBefore: (id) => move(id, "before"),
          moveAfter: (id) => move(id, "after"),
        },
        clean: [
          (stage) => {
            for (const bat of stage.querySelectorAll("[data-blank]")) {
              bat.remove();
            }
            for (const bat of stage.querySelectorAll("[data-move]")) {
              bat.removeAttribute("data-move");
              bat.removeAttribute("style");
            }
            // this.#unWrap("move", stage);
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
        "tuck",
        "vault",
        "spin",
        "colorize",
        "salute",
      ];
      const permas = [];

      const api = {};
      const short = {};
      const clean = [];

      for (const skill of [...skills, ...permas]) {
        const fixy = `${this.#opts.fix}-${skill}`;
        api[skill] = (val) => this.#wrap(skill, !val || { [`--${fixy}-val`]: val });
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
        }
        return this.#API;
      };
      return {
        short: {},
        api: {
          grow: (v) => groink("fore", v),
          shrink: (v) => groink("back", v),
        },
        clean: [
          (stage) => {
            for (const bat of stage.querySelectorAll("[data-grow]")) {
              const val = bat.getAttribute("data-grow");
              if (val === "fore") this.#unWrap("grow", stage);
              else if (val === "back") bat.remove();
            }
          },
        ],
      };
    }

    #makeJestorSkills() {
      const skills = {
        draw: ["cank", "xout", "brak"],
        clip: ["cirk"],
      };
      const unSkill = (s) => "un" + s[0].toUpperCase() + s.slice(1);

      const makeHTML = {
        draw: (html, skill) => {
          return `
           <x>${html}</x>
           <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path data-main data-${skill} />
           </svg>
          `;
        },
        clip: (html, skill) => {
          const clipID = `${this.#opts.fix}-${crypto.randomUUID()}`;
          return `
           <x>${html}</x>
           <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
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
          api[unSkill(skill)] = () => {
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
            );
            const val = bat.getAttribute("val");
            if (bat.id) tag.id = bat.id;
            if (val) tag.style.setProperty(`--${fixy}-val`, val);
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
            } else {
              log("[[[cleaning jest with no value]]]");
            }
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
      // #region FRAK
      /*
      // frak
      (() => {
        const frakHTML = (id) => `
         <x data-frak-holder>
          <x data-frak>
           <x data-numerator ${id ? `id="${id}-numerator"` : ""}></x>
           <x data-slash ${id ? `id="${id}-slash"` : ""}>
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
             <path/>
            </svg>
           </x>
           <x data-denominator ${id ? `id="${id}-denominator"` : ""}></x>
          </x>
         </x>
        `;
        return {
          shorthand: [
            "mbx-frak",
            (bat) => {
              if (bat.children.length !== 2) return;
              const [orgNum, orgDen] = bat.children;
              const top = this.#makeTag("x", frakHTML(bat?.id));
              const frak = top.querySelector("[data-frak]");
              frak.children[0].append(orgNum);
              frak.children[2].append(orgDen);
              if (bat.id) top.id = bat.id;
              return top;
            },
          ],
          api: {
            frak: (...ids) => {
              const bat0 = this.#batties[0];
              const frakID = `${bat0.id}-frak`;

              const top = this.#makeTag("x", frakHTML(frakID));
              const frak = top.querySelector("[data-frak]");
              frak.setAttribute("data-frak", "fore");
              const [num, slash, den] = frak.children;
              top.id = frakID;
              bat0.parentNode.insertBefore(top, bat0);
              for (const bat of this.#batties) num.append(bat);
              for (const id of new Set(ids)) den.append(this.#API.pick(id));
              return this.#API.spot(frakID);
            },
            unFrak: () => {
              for (const bat of this.#batties) {
                const frak = bat?.children[0]?.children[0];
                if (!frak) continue;
                frak.setAttribute("data-frak", "back");
              }
              return this.#API;
            },
          },
          clean: (stage) => {
            for (const bat of stage.querySelectorAll(
              `[data-frak="fore"], [data-frak="back"]`,
            )) {
              const val = bat.getAttribute("data-frak");
              if (val === "fore") {
                bat.setAttribute("data-frak", "");
              } else if (val === "back") {
                const top = bat?.parentNode?.parentNode;
                const num = bat?.children?.[0];
                if (!top || !num) continue;
                top.replaceWith(...[...num.childNodes]);
              }
            }
          },
        };
      })(),
      */
      // #endregion
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
      // TEST & STALL
      // await new Promise((r) => setTimeout(r, 800));

      // load new stage if needed
      step.load ||= this.#stageObj.innerHTML;

      // make the step tags
      const stepTag = this.#makeStepTag(step.load, step.note || "");

      // set the stage object
      this.#stageObj = stepTag.children[0];

      // replace shorthands
      this.#replaceShorthands(this.#stageObj);

      // append the steptags
      this.#holder.append(stepTag);

      // !!! layout HAKC - must be here for measuring !!!
      // await new Promise((r) => requestAnimationFrame(r));
      //
      // set measurements - requires HAKC
      // this.#measureElements(...this.#stageObj.querySelectorAll("*"));

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
      // this.#removeIDs(stepTag.children[0]);
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

      this.#stageObj = this.#saniTag("x", routine.stage, { stage: "" });

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
