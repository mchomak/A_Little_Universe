from __future__ import annotations

import unittest
from copy import deepcopy

import check_material_contract as checker


def valid_sampling() -> dict:
    return {
        "mode": "absolute-clip-time",
        "interpolation": "piecewise-linear",
        "formula": "factor(t)=lerp(k[i].linearSrgbFactor,k[i+1].linearSrgbFactor,(clamp(t,0,9)-t[i])/(t[i+1]-t[i])); interpolate each RGB channel independently",
        "endpointClamping": True,
        "nonGrowth": "mature",
        "crossfade": {
            "durationSeconds": 0.25,
            "space": "linear-sRGB",
            "formula": "lerp(sourceFactor,targetFactor,clamp(transitionElapsedSeconds/0.25,0,1))",
            "sourceAndTarget": "sample each clip at its absolute clip time; non-Growth clips use their mature factor",
            "reverseScrub": "recompute from source/target absolute clip times and transition elapsed time; do not accumulate frame deltas",
        },
    }


class MaterialContractTests(unittest.TestCase):
    def test_accepts_full_sampling_contract(self) -> None:
        checker.validate_sampling_contract(valid_sampling())

    def test_rejects_non_spec_crossfade_duration(self) -> None:
        sampling = valid_sampling()
        sampling["crossfade"]["durationSeconds"] = 0.5
        with self.assertRaises(AssertionError):
            checker.validate_sampling_contract(sampling)

    def test_rejects_missing_sampling_and_scrub_invariants(self) -> None:
        invalid_contracts = {
            "absolute clip-time mode": lambda value: value.update(mode="frame-delta"),
            "endpoint clamp flag": lambda value: value.update(endpointClamping=False),
            "growth time clamp formula": lambda value: value.update(formula="factor(t)=lerp(k[i],k[i+1],(t-t[i])/(t[i+1]-t[i]))"),
            "absolute-time crossfade endpoints": lambda value: value["crossfade"].update(sourceAndTarget="use accumulated frame values"),
            "reverse-scrub recomputation": lambda value: value["crossfade"].update(reverseScrub="accumulate frame deltas"),
            "clamped crossfade formula": lambda value: value["crossfade"].update(formula="lerp(sourceFactor,targetFactor,transitionElapsedSeconds/0.25)"),
        }
        for label, mutate in invalid_contracts.items():
            with self.subTest(invariant=label):
                sampling = deepcopy(valid_sampling())
                mutate(sampling)
                with self.assertRaises(AssertionError):
                    checker.validate_sampling_contract(sampling)


if __name__ == "__main__":
    unittest.main()
