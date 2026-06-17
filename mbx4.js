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
    #API;
    // #endregion

    constructor(holder, opts) {
      this.#opts = opts;
      this.#holder = holder;
      this.#API = this.#makeAPI();
    }

    // #region SPOT UTILS
    #markup(html) {
      return html
        .trim()
        .replace(/\s+/g, " ")
        .replace(/>\s+</g, "> <")
        .replace(
          /([^\s])\^(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g,
          "$1<x data-sup>$2</x>",
        )
        .replace(
          /([^\s])\_(\(.+?\)|\<.+?\>.+?\<.+?\>|[^\s]+)/g,
          "$1<x data-sub>$2</x>",
        )
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

      // strip any non x tags

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

    #saniTag(tag, html, vals) {
      return this.#makeTag(tag, this.#strip(html), vals);
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

    #removeIDs(stage) {
      for (const bat of stage.querySelectorAll("x[id]")) {
        bat.removeAttribute("id");
      }
    }

    #namespaceIDs(stage, fix, stepNum) {
      for (const bat of stage.querySelectorAll("[id]")) {
        bat.id = `${fix}-step-${stepNum}-${el.id}`;
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
    // #endregion

    #xxx_move(anchorID, direction) {
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
        direction === "after"
          ? Array.from(this.#batties).reverse()
          : Array.from(this.#batties);

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

        bat.innerHTML = `<x data-move>${bat.innerHTML}</x>`;
        const wrapper = bat.children[0];
        wrapper.style.setProperty(
          `--${this.#opts.fix}-dx`,
          `${Math.round(dx)}px`,
        );
        wrapper.style.setProperty(
          `--${this.#opts.fix}-dy`,
          `${Math.round(dy)}px`,
        );
        wrapper.style.setProperty(`--${this.#opts.fix}-old-font`, bat.oldFont);
        wrapper.style.setProperty(`--${this.#opts.fix}-new-font`, bat.newFont);
      }
      return this.#API;
    }

    #move(anchorID, direction) {
      log('moving on up')
      const anchor = this.#API.pick(anchorID);
      if (!anchor) return this.#API;

      const batsArray = new Set(
        direction === "after"
          ? Array.from(this.#batties).reverse()
          : Array.from(this.#batties),
      );

      const allBats = Array.from(this.#stageObj.querySelectorAll("*")); //.filter(el => !batsArray.has(el));
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

        bat.innerHTML = `<x data-move>${bat.innerHTML}</x>`;
        const wrapper = bat.children[0];
        wrapper.style.setProperty(
          `--${this.#opts.fix}-dx`,
          `${Math.round(dx)}px`,
        );
        wrapper.style.setProperty(
          `--${this.#opts.fix}-dy`,
          `${Math.round(dy)}px`,
        );
        wrapper.style.setProperty(`--${this.#opts.fix}-old-font`, bat.oldFont);
        wrapper.style.setProperty(`--${this.#opts.fix}-new-font`, bat.newFont);
      }
      return this.#API;
    }

    // #region SKILLS API
    #SKILLS = [
      // #region WRAPS
      // viva
      {
        api: () => ({ viva: () => this.#wrap("viva") }),
        cleanup: (stage) => this.#unWrap("viva", stage),
      },
      // ghost
      {
        api: () => ({ ghost: () => this.#wrap("ghost") }),
        cleanup: (stage) => this.#unWrap("ghost", stage),
      },
      // vaporize
      {
        api: () => ({ vaporize: () => this.#wrap("vaporize") }),
        cleanup: (stage) => this.#unWrap("vaporize", stage),
      },
      // materialize
      {
        api: () => ({ materialize: () => this.#wrap("materialize") }),
        cleanup: (stage) => this.#unWrap("materialize", stage),
      },
      // tuck
      {
        api: () => ({ tuck: () => this.#wrap("tuck") }),
        cleanup: (stage) => this.#unWrap("tuck", stage),
      },
      // vault
      {
        api: () => ({ vault: () => this.#wrap("vault") }),
        cleanup: (stage) => this.#unWrap("vault", stage),
      },
      // spin
      {
        api: () => ({ spin: () => this.#wrap("spin") }),
        cleanup: (stage) => this.#unWrap("spin", stage),
      },
      // #endregion

      // #region GROWTH
      // grow | shrink
      (() => {
        const gronk = (dir, v) => {
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
          api: () => ({
            grow: (v) => gronk("fore", v),
            shrink: (v) => gronk("back", v),
          }),
          cleanup: (stage) => this.#unWrap("grow", stage),
        };
      })(),
      // #endregion

      // #region GESTURES
      // cank
      (() => {
        const cankHTML = (html) => `
          <x>${html}</x>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
           <path/>
          </svg>
        `;
        return {
          shorthand: [
            "mbx-cank",
            (bat) => {
              const rot = bat.getAttribute("rot");
              const tmp = this.#makeTag("x", cankHTML(bat.innerHTML), {
                cank: "",
                ...(rot && { "--cank-rotate": rot }),
              });
              const cank = this.#makeTag("x", tmp.outerHTML);
              if (bat.id) cank.id = bat.id;
              return cank;
            },
          ],
          api: () => ({
            cank: (rot) => {
              for (const bat of this.#batties) {
                const cank = this.#makeTag("x", cankHTML(bat.innerHTML), {
                  cank: "fore",
                  ...(rot && { "--cank-rotate": rot }),
                });
                bat.innerHTML = `${cank.outerHTML}`;
              }
              return this.#API;
            },
            unCank: () => {
              for (const bat of this.#batties) {
                for (const cank of bat.querySelectorAll("[data-cank]")) {
                  cank.setAttribute("data-cank", "back");
                }
              }
              return this.#API;
            },
          }),
          cleanup: (stage) => {
            for (const bat of stage.querySelectorAll("[data-cank]")) {
              const val = bat.getAttribute("data-cank");
              if (val === "fore") {
                bat.setAttribute("data-cank", "");
              } else if (val === "back") {
                const targ = bat.children[0];
                bat.replaceWith(...[...targ.childNodes]);
              }
            }
          },
        };
      })(),

      // cirk
      (() => {
        const cirkHTML = (html) => {
          const clipID = `${this.#opts.fix}-${crypto.randomUUID()}`;
          return `
           <x>${html}</x>
           <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <clipPath id="${clipID}"><path/></clipPath>
            <path clip-path="url(#${clipID})" />
           </svg>
          `;
        };
        return {
          shorthand: [
            "mbx-cirk",
            (bat) => {
              const cirk = this.#makeTag("x", cirkHTML(bat.innerHTML), {
                cirk: "",
              });
              if (bat.id) cirk.id = bat.id;
              return cirk;
            },
          ],
          api: () => ({
            cirk: (rot) => {
              for (const bat of this.#batties) {
                bat.innerHTML = cirkHTML(bat.innerHTML);
                bat.setAttribute("data-cirk", "fore");
                if (rot) {
                  bat.style.setProperty("--cirk-rotate", rot);
                }
              }
              return this.#API;
            },
            unCirk: () => {
              for (const bat of this.#batties) {
                if (!bat.hasAttribute("data-cirk")) return;
                bat.setAttribute("data-cirk", "back");
                log("uncirk got here");
              }
              return this.#API;
            },
          }),
          cleanup: (stage) => {
            for (const bat of stage.querySelectorAll("[data-cirk]")) {
              const val = bat.getAttribute("data-cirk");
              if (val === "fore" || val === "back") {
                const targ = bat.children[0];
                bat.replaceWith(...[...targ.childNodes]);
              }
            }
          },
        };
      })(),

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
          api: () => ({
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
          }),
          cleanup: (stage) => {
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
      // #endregion

      // during
      {
        api: () => ({
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
        }),
        cleanup: (stage) => {
          for (const bat of stage.querySelectorAll("[style]")) {
            bat.removeAttribute("style");
          }
        },
      },

      // move !
      {
        cleanup: (stage) => {
          for (const bat of stage.querySelectorAll("[data-blank]")) {
            bat.remove();
          }
          this.#unWrap("move", stage);
        },
      },

      // wink
      {
        api: () => ({
          wink: (v = 1000) => {
            const batties = this.#batties;
            for (const bat of this.#batties) {
              let targ;
              if (bat.tagName === "path") {
                bat.parentNode.setAttribute("data-wink", "");
                targ = bat.parentNode;
              } else {
                this.#API.spot(bat.id);
                this.#wrap("wink");
                targ = bat.children[0];
              }
              bat.style.setProperty(`--${this.#opts.fix}-wink-dur`, `${v}ms`);
              const anim = targ.getAnimations()?.[0];
              if (!anim) continue;
              anim.onfinish = (e) => {
                bat.classList.add(`${this.#opts.fix}-wink`);
                setTimeout(
                  () => bat.classList.remove(`${this.#opts.fix}-wink`),
                  v,
                );
              };
            }
            this.#batties = batties;
            return this.#API;
          },
        }),
      },

      // #region SHORTHAND
      // data-vert
      {
        shorthand: [
          "[data-vert]",
          (bat) => {
            bat.style.transform = `translateY(${bat.dataset.vert || 0})`;
            bat.removeAttribute("data-vert");
            return bat;
          },
        ],
      },
      // #endregion
    ];

    #makeAPI = () => {
      const api = {
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
        mount: (id, html, vals) => {
          const bat = this.#makeTag("x", html, vals);
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
            beef.parentNode.insertBefore(bat, beef);
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
          }
          this.#measureElements(...this.#batties);
          return api;
        },
        hide: () => {
          for (const bat of this.#batties) {
            bat.style.display = "none";
          }
          this.#measureElements(...this.#batties);
          return api;
        },
        show: () => {
          for (const bat of this.#batties) {
            bat.style.display = "revert";
          }
          this.#measureElements(...this.#batties);
          return api;
        },
        origin: (v) => {
          for (const bat of this.#batties) {
            bat.children[0].style.setProperty("transform-origin", v);
          }
        },
        moveBefore: (id) => this.#move(id, "before"),
        moveAfter: (id) => this.#move(id, "after"),
      };

      for (const skill of this.#SKILLS) {
        if (skill.api) Object.assign(api, skill.api());
      }

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

    #replaceShorthands(stage) {
      for (const skill of this.#SKILLS) {
        if (skill?.shorthand?.length > 1) {
          const [short, sweet] = skill.shorthand;
          for (const bat of stage.querySelectorAll(short)) {
            bat.replaceWith(sweet(bat));
          }
        }
      }
    }

    #runCleanups(stage) {
      for (const skill of this.#SKILLS) {
        skill.cleanup?.(stage);
      }
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
