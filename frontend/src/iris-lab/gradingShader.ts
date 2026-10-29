/** Uniform declarations shared by the iris, particle and fibre grading shaders. */
export const irisGradingUniformsGlsl = /* glsl */ `
uniform float gradeEnabled;
uniform float gradeStrength;
uniform float gradeTargetBlueHue;
uniform float gradeBlueChroma;
uniform float gradeGrayRecolorStrength;
uniform float gradeLightnessPreservation;
uniform float gradeBrightness;
uniform float gradeContrast;
uniform float gradeInnerZoneRadius;
uniform float gradeAmberHue;
uniform float gradeAmberChroma;
uniform float gradeAmberPreservation;
uniform float gradeAmberTransitionWidth;
uniform float gradeMiddleBlueHue;
uniform float gradeMiddleBlueChroma;
uniform float gradeMiddleColorStrength;
uniform float gradeOuterZoneStart;
uniform float gradeOuterBlueHue;
uniform float gradeOuterBlueChroma;
uniform float gradeOuterColorStrength;
uniform float gradeLimbalRingHue;
uniform float gradeLimbalRingChroma;
uniform float gradeLimbalRingDarkness;
uniform vec3 gradeFiberArtisticColor;
uniform float gradeFiberArtisticMix;
`

/**
 * GLSL ES helpers equivalent to gradingMath.ts. Inputs and outputs are
 * linear-sRGB; the caller supplies radius normalized from pupil edge (0) to
 * limbal edge (1). Apply any artistic fibre tint after gradeIris via
 * gradeIrisFiber so its intensity remains independent from color grading.
 */
export const irisGradingFunctionsGlsl = /* glsl */ `
const float IRIS_PI = 3.14159265358979323846;

float irisHueDistance(float a, float b) {
  return abs(mod(a - b + 540.0, 360.0) - 180.0);
}

vec3 irisLinearSrgbToOklab(vec3 rgb) {
  vec3 lms = vec3(
    0.4122214708 * rgb.r + 0.5363325363 * rgb.g + 0.0514459929 * rgb.b,
    0.2119034982 * rgb.r + 0.6806995451 * rgb.g + 0.1073969566 * rgb.b,
    0.0883024619 * rgb.r + 0.2817188376 * rgb.g + 0.6299787005 * rgb.b
  );
  vec3 roots = sign(lms) * pow(abs(lms), vec3(1.0 / 3.0));
  return vec3(
    0.2104542553 * roots.x + 0.7936177850 * roots.y - 0.0040720468 * roots.z,
    1.9779984951 * roots.x - 2.4285922050 * roots.y + 0.4505937099 * roots.z,
    0.0259040371 * roots.x + 0.7827717662 * roots.y - 0.8086757660 * roots.z
  );
}

vec3 irisOklabToLinearSrgb(vec3 lab) {
  vec3 roots = vec3(
    lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z,
    lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z,
    lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z
  );
  vec3 lms = roots * roots * roots;
  return vec3(
    4.0767416621 * lms.x - 3.3077115913 * lms.y + 0.2309699292 * lms.z,
    -1.2684380046 * lms.x + 2.6097574011 * lms.y - 0.3413193965 * lms.z,
    -0.0041960863 * lms.x - 0.7034186147 * lms.y + 1.7076147010 * lms.z
  );
}

vec3 irisOklchToLab(float lightness, float chroma, float hueDegrees) {
  float angle = hueDegrees * IRIS_PI / 180.0;
  return vec3(lightness, chroma * cos(angle), chroma * sin(angle));
}

vec3 irisGamutMapOklab(vec3 lab) {
  vec3 direct = irisOklabToLinearSrgb(lab);
  if (all(greaterThanEqual(direct, vec3(0.0))) && all(lessThanEqual(direct, vec3(1.0)))) {
    return direct;
  }

  float chroma = length(lab.yz);
  if (chroma < 0.00000001) {
    return clamp(irisOklabToLinearSrgb(vec3(clamp(lab.x, 0.0, 1.0), 0.0, 0.0)), 0.0, 1.0);
  }

  vec2 hue = lab.yz / chroma;
  float low = 0.0;
  float high = 1.0;
  for (int i = 0; i < 14; i++) {
    float scale = (low + high) * 0.5;
    vec3 candidate = irisOklabToLinearSrgb(vec3(lab.x, hue * chroma * scale));
    bool inGamut = all(greaterThanEqual(candidate, vec3(0.0))) && all(lessThanEqual(candidate, vec3(1.0)));
    if (inGamut) low = scale;
    else high = scale;
  }
  return clamp(irisOklabToLinearSrgb(vec3(lab.x, hue * chroma * low)), 0.0, 1.0);
}

vec3 gradeIris(vec3 sourceLinear, float normalizedRadius) {
  if (gradeEnabled < 0.5 || gradeStrength <= 0.0) return sourceLinear;

  float radius = clamp(normalizedRadius, 0.0, 1.0);
  vec3 sourceLab = irisLinearSrgbToOklab(sourceLinear);
  float sourceChroma = length(sourceLab.yz);
  float sourceHue = sourceChroma < 0.00000001
    ? 0.0
    : mod(atan(sourceLab.z, sourceLab.y) * 180.0 / IRIS_PI + 360.0, 360.0);
  float innerRadius = clamp(gradeInnerZoneRadius, 0.0, 0.48);
  float transition = clamp(gradeAmberTransitionWidth, 0.01, 0.16);
  float outerStart = clamp(max(gradeOuterZoneStart, innerRadius + transition * 2.0), innerRadius + transition * 2.0, 0.98);

  float inner = 1.0 - smoothstep(innerRadius, innerRadius + transition, radius);
  float middle = smoothstep(innerRadius, innerRadius + transition, radius)
    * (1.0 - smoothstep(outerStart - transition, outerStart + transition, radius));
  float outer = smoothstep(outerStart - transition, outerStart + transition, radius);
  float limbal = smoothstep(0.86, 0.94, radius);

  float grayConfidence = smoothstep(0.008, 0.042, sourceChroma);
  float grayFactor = mix(clamp(gradeGrayRecolorStrength, 0.0, 1.0), 1.0, grayConfidence);
  float amberHueMask = 1.0 - smoothstep(24.0, 52.0, irisHueDistance(sourceHue, gradeAmberHue));
  float amberColorMask = smoothstep(0.018, 0.055, sourceChroma) * amberHueMask;
  float amberMask = inner * amberColorMask;
  float protectionEnd = clamp(innerRadius + transition * 2.0, 0.0, 1.0);
  float amberProtection = 1.0 - smoothstep(innerRadius + transition, protectionEnd, radius);
  float preservedAmber = amberProtection * amberColorMask * clamp(gradeAmberPreservation, 0.0, 1.0);

  vec3 mainTarget = irisOklchToLab(sourceLab.x, gradeBlueChroma, gradeTargetBlueHue);
  vec3 middleTarget = irisOklchToLab(sourceLab.x, gradeMiddleBlueChroma, gradeMiddleBlueHue);
  vec3 outerTarget = irisOklchToLab(sourceLab.x, gradeOuterBlueChroma, gradeOuterBlueHue);
  vec3 amberTarget = irisOklchToLab(sourceLab.x, gradeAmberChroma, gradeAmberHue);
  vec3 ringTarget = irisOklchToLab(sourceLab.x, gradeLimbalRingChroma, gradeLimbalRingHue);

  vec2 ab = sourceLab.yz;
  float middleAmount = clamp(gradeStrength, 0.0, 1.0) * middle * clamp(gradeMiddleColorStrength, 0.0, 1.0) * grayFactor * (1.0 - preservedAmber);
  float outerAmount = clamp(gradeStrength, 0.0, 1.0) * outer * clamp(gradeOuterColorStrength, 0.0, 1.0) * grayFactor * (1.0 - preservedAmber);
  vec2 middleAb = mix(mainTarget.yz, middleTarget.yz, grayConfidence);
  ab = mix(ab, middleAb, middleAmount);
  ab = mix(ab, outerTarget.yz, outerAmount);

  float amberAmount = clamp(gradeStrength, 0.0, 1.0) * amberMask * (1.0 - clamp(gradeAmberPreservation, 0.0, 1.0));
  ab = mix(ab, amberTarget.yz, amberAmount);

  float radialTargetL = mix(0.62, 0.49, outer);
  float lightness = mix(radialTargetL, sourceLab.x, clamp(gradeLightnessPreservation, 0.0, 1.0));
  lightness = mix(sourceLab.x, lightness, clamp(gradeStrength * max(middle * gradeMiddleColorStrength, outer * gradeOuterColorStrength), 0.0, 1.0));
  float ringAmount = clamp(gradeStrength, 0.0, 1.0) * limbal * clamp(gradeOuterColorStrength, 0.0, 1.0) * grayFactor;
  ab = mix(ab, ringTarget.yz, ringAmount);
  lightness *= 1.0 - clamp(gradeLimbalRingDarkness, 0.0, 1.0) * limbal * clamp(gradeStrength, 0.0, 1.0) * grayFactor;
  lightness = (lightness - 0.5) * gradeContrast + 0.5 + gradeBrightness;
  return irisGamutMapOklab(vec3(clamp(lightness, 0.0, 1.0), ab));
}

vec3 gradeIrisFiber(vec3 sourceLinear, float normalizedRadius) {
  vec3 graded = gradeIris(sourceLinear, normalizedRadius);
  return mix(graded, gradeFiberArtisticColor, clamp(gradeFiberArtisticMix, 0.0, 1.0));
}
`
