# Дополнение — узнаваемая сборка фото коллажа

> я хочу чтобы фото с колажа не просто появлялись из частиц,
> Мы берем оригинальное фото (которое хотим показать) прогоняем его через `memory-signal-threejs`  получаем его вид из частиц.&#x20;
> На сайте  строим фото из частиц (сейчас дольше) и дальше оно 3-4 секунды весит в виде частиц анимированное, чтобы частицы двигались (как на demo сайте `memory-signal-threejs`), и картинка была различима сразу по частицам, то есть их нужно заложить как можно больше на ту площать, чтобы по частицам можно было уже узнать фото. и только потом фото проявляется в оригинальное.
> коммит пуш и пересборка сайта

## Acceptance

- Sample the original extra photo and use its pixels to form a dense, recognizable particle image with the local `memory-signal-threejs` adaptation.
- Keep the image as a gently animated particle portrait for 3–4 seconds after assembly, then progressively reveal the original photo through the existing scene 04 reveal algorithm.
- Preserve one active collage, the shared canvas/runtime, repeat-focus and quick-exit cleanup. Keep the site buildable and push the completed change to `codex/review-gallery`.
