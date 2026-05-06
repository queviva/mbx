((doc, self) => {
  const log = console.log;

  // 0. !!!HAKC!!!  pull in external css
  // instead of const styleRule = `...`;
  // with injected ${this.app.fix} values
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "mathrobatics.css";
  document.head.appendChild(link);

  // 1. HELPER: The Sieve (Strictly pulls keys that exist in 'target')
  const sieve = (target, incoming) => {
    return Object.fromEntries(
      Object.keys(target).map((key) => [
        key,
        incoming.hasOwnProperty(key) ? incoming[key] : target[key],
      ]),
    );
  };

  // 2. HELPER: Clean JSON Parse
  const parseData = (raw) => {
    try {
      return JSON.parse(raw.replace(/\s+/g, " "));
    } catch (e) {
      return {};
    }
  };

  // 3. CAPTURE SCRIPT OPTS
  const defOpts = {
    tag: "mathro-batics",
    fix: "mb",
    hop: "1.5em",
    dur: "1.5s",
  };
  const devOpts = parseData(self.dataset[0]);

  // This is the "App Level" config
  const appOpts = sieve(defOpts, devOpts);

  const boot = () => {
    if (!customElements.get(appOpts.tag)) {
      customElements.define(
        appOpts.tag,
        class extends HTMLElement {
          constructor() {
            super();
            // Start with App Level Options
            this.opts = { ...appOpts };
          }

          connectedCallback() {
            // 4. INSTANCE OVERWRITE
            // Look for data-[prefix] on this specific tag
            const instanceRaw = this.dataset[appOpts.fix];
            if (instanceRaw) {
              const instanceOverrides = parseData(instanceRaw);
              // Sieve again so the user can't inject junk into the instance
              this.opts = sieve(this.opts, instanceOverrides);
            }

            // Apply instance-specific CSS variables if needed
            this.style.setProperty(`--${appOpts.fix}-dur`, this.opts.dur);

            console.log(`Initialized <${appOpts.tag}>`, this.opts);
          }
        },
      );
    }

    // 5. INJECT GLOBAL CSS (Using App-Level Prefix)
    const style = document.createElement("style");
    style.textContent = `
      ${appOpts.tag} { display: block; contain: layout; }
      ::view-transition-group(.${appOpts.fix}-moving) {
        animation-duration: var(--${appOpts.fix}-dur, ${appOpts.dur});
      }
      @keyframes ${appOpts.fix}-hop {
        50% { transform: translateY(calc(-1 * ${appOpts.hop})); }
      }
    `;
    document.head.appendChild(style);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(document, document.currentScript);
