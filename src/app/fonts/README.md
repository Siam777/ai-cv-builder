# Bundled product fonts

These unmodified WOFF2 assets are served locally through `next/font/local`. Builds and browser visits do not fetch font services. These assets style product controls and display headings, and are also used for resume typography as documented below.

| Asset | Upstream source | SHA-256 |
| --- | --- | --- |
| SourceSans3-Upright.woff2 (variable weight 200–900) | [Adobe Source Sans, commit 87b37a2](https://github.com/adobe-fonts/source-sans/blob/87b37a2daaed80fcb8e8ccb0085c4d72ddade12e/WOFF2/VF/SourceSans3VF-Upright.ttf.woff2) | `5f16566f7a40d39b339ad26be151fa5a1ab1f0c2574c7a2e619765584a1acbd8` |
| SourceSerif4-Regular.woff2 (weight 400) | [Adobe Source Serif, commit 80d3f88](https://github.com/adobe-fonts/source-serif/blob/80d3f8894c09c937bebfa9011247d2e1c79fd6f4/WOFF2/TTF/SourceSerif4-Regular.ttf.woff2) | `6b053e98f0838afe81f3e784727be4583a7c13bb42f198dc5202ecffee0aaee0` |

Both families include their upstream SIL Open Font License 1.1 and copyright notices in this directory. Downloaded 2026-10-10. Combined font payload: 246,448 bytes before HTTP compression. System fallbacks cover characters unavailable in these fonts.

## Resume typography (Q3)

Resume `sans` and `serif` settings now use the existing unmodified Source Sans 3 and Source Serif 4 assets. `humanist` uses Lato Regular (unmodified TTF), supplied by the [Google Fonts repository](https://github.com/google/fonts/tree/f3b885d5590e307e02542f1a724cec55d567fdaa/ofl/lato), copyright tyPoland Lukasz Dziedzic, SIL OFL 1.1 with Reserved Font Name Lato. Its full license is `Lato-LICENSE.txt`.

Lato SHA-256: `d636e4683231f931eda222d588e944d082bfd3bdba02f928bee461c0f185b251`.

`resume-fonts.css` loads the same local files in previews; standalone HTML embeds approved files as data URLs. Export rendering makes no font network requests. Word names these font families, but recipients need them installed and may see substitutions; no system-wide font installation is performed. Bold/italic styles not included in a static asset are synthesized by the renderer. Legacy setting keys (`sans`, `serif`, `humanist`) remain valid; typography and wrapping can change, while stored career facts remain intact. Unicode outside these fonts' coverage still relies on local fallback fonts and needs separate script-specific review.
