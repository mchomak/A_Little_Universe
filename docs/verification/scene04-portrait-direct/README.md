# Screenshot evidence

- `baseline/`: actual committed baseline 01c4d925, 1024×768. These are not the missing screenshots listed by the user.
- `candidate-01/`, `candidate-02/`: rejected intermediate t8/t10 captures, retained to explain the readability correction.
- `after/`: final renderer. Main requested frames: t2, t5, t8, t10, t13, t17, t20. Additional boundary/assembly frames and gallery entry are included.
- `reduced-low-*`: final low-quality/reduced-motion path. `portrait-reduced-low-t17.png`: 768×1024 layout.
- `reverse-seek-t8.png`, `reenter-t8.png`: final standard-quality, normal-motion deterministic replay checks.

DEV panel/toggle were hidden by temporary browser CSS for captures; the shipping presentation UI remains visible. Native DEV controls drove pause and seek. Captures waited for the correct time label and fresh animation frames. Scripts in the Autopilot record compare the documented photo/replay ROIs; both have zero pixel difference. Screenshots do not prove physical-device performance or absence of GPU heap leaks.
