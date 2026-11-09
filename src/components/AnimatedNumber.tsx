import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import "./AnimatedNumber.css";

type Direction = "up" | "down";
type Variant = "money" | "clock";

export type AnimatedNumberProps = {
  value: string;
  className?: string;
  direction?: Direction;
  variant?: Variant;
  animate?: boolean;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DIGIT_STEP = 1.1;
const REEL_DIGITS = Array.from({ length: 30 }, (_, index) => index % 10);

function subscribeToMotionPreference(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const preference = window.matchMedia(REDUCED_MOTION_QUERY);
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function isDocumentVisible(): boolean {
  return document.visibilityState !== "hidden";
}

function reelTransform(index: number): string {
  const offset = Number((-index * DIGIT_STEP).toFixed(4));
  return `translateY(${offset}em)`;
}

function currentReelIndex(element: HTMLSpanElement, fallback: number): number {
  const style = getComputedStyle(element);
  const matrix = style.transform.match(/^matrix(3d)?\(([^)]+)\)$/);
  const fontSize = Number.parseFloat(style.fontSize);
  if (matrix && fontSize > 0) {
    const values = matrix[2].split(",").map(Number);
    const translateY = values[matrix[1] ? 13 : 5];
    if (Number.isFinite(translateY)) return -translateY / fontSize / DIGIT_STEP;
  }
  return fallback;
}

function RollingDigit({
  digit,
  direction,
  variant,
  animate,
  reducedMotion,
  visible,
}: {
  digit: number;
  direction: Direction;
  variant: Variant;
  animate: boolean;
  reducedMotion: boolean;
  visible: boolean;
}) {
  const reel = useRef<HTMLSpanElement>(null);
  const previousDigit = useRef(digit);
  const animation = useRef<Animation | null>(null);
  const wasVisible = useRef(visible);
  const resumedAt = useRef(-Infinity);

  useLayoutEffect(() => {
    const element = reel.current;
    if (!element) return;
    const now = performance.now();
    if (visible && !wasVisible.current) resumedAt.current = now;
    wasVisible.current = visible;
    const previous = previousDigit.current;
    previousDigit.current = digit;
    const start = currentReelIndex(element, 10 + previous);
    animation.current?.cancel();
    element.style.transform = reelTransform(10 + digit);

    if (
      !animate ||
      reducedMotion ||
      !visible ||
      now - resumedAt.current < 1200 ||
      previous === digit ||
      !element.animate
    ) {
      animation.current = null;
      return;
    }

    // Keep the interrupted visual position while bringing it into the middle
    // repetition. All three repetitions show the same sequence of digits.
    const normalizedStart = 10 + (((start % 10) + 10) % 10);
    const target =
      direction === "up"
        ? normalizedStart + ((digit - (normalizedStart % 10) + 10) % 10)
        : normalizedStart - (((normalizedStart % 10) - digit + 10) % 10);
    const movement = element.animate(
      [
        { transform: reelTransform(normalizedStart) },
        { transform: reelTransform(target) },
      ],
      {
        duration: variant === "clock" ? 420 : 680,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    );
    animation.current = movement;
    movement.onfinish = () => {
      if (animation.current === movement) animation.current = null;
    };
  }, [digit, direction, variant, animate, reducedMotion, visible]);

  useEffect(() => () => animation.current?.cancel(), []);

  return (
    <span className="an-digit" data-digit={digit}>
      <span className="an-digit-reel" ref={reel}>
        {REEL_DIGITS.map((number, index) => (
          <span className="an-digit-row" key={index}>
            {number}
          </span>
        ))}
      </span>
    </span>
  );
}

export function AnimatedNumber({
  value,
  className = "",
  direction = "up",
  variant = "money",
  animate = true,
}: AnimatedNumberProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    prefersReducedMotion,
    () => false,
  );

  const visible = useSyncExternalStore(
    subscribeToVisibility,
    isDocumentVisible,
    () => true,
  );

  const characters = (text: string, part: string) =>
    Array.from(text).map((character, index) => {
      const position = part === "fraction" ? index : text.length - index - 1;
      return /\d/.test(character) ? (
        <RollingDigit
          key={`${part}-digit-${position}`}
          digit={Number(character)}
          direction={direction}
          variant={variant}
          animate={animate}
          reducedMotion={reducedMotion}
          visible={visible}
        />
      ) : (
        <span
          className={`an-separator ${character === ":" ? "an-clock-separator" : ""}`}
          key={`${part}-separator-${position}`}
        >
          {character}
        </span>
      );
    });

  const prefixLength = value.search(/\d/);
  const prefix = prefixLength > 0 ? value.slice(0, prefixLength) : "";
  const number = prefixLength > 0 ? value.slice(prefixLength) : value;
  const decimalIndex = variant === "money" ? number.lastIndexOf(".") : -1;
  const integer = decimalIndex >= 0 ? number.slice(0, decimalIndex) : number;
  const fraction = decimalIndex >= 0 ? number.slice(decimalIndex) : "";
  const sizeClass =
    variant === "money" && integer.length > 12
      ? "an-number--very-long"
      : variant === "money" && integer.length > 6
        ? "an-number--long"
        : "";

  return (
    <span
      className={`an-number an-number--${variant} ${sizeClass} ${className}`}
      role="img"
      aria-label={value}
      data-value={value}
    >
      <span className="an-visual" aria-hidden="true">
        {prefix && <span className="an-currency">{prefix}</span>}
        <span className="an-integer">{characters(integer, "integer")}</span>
        {fraction && (
          <span className="an-fraction">
            {characters(fraction, "fraction")}
          </span>
        )}
      </span>
    </span>
  );
}

export function MoneyDisplay({
  value,
  precision = 4,
  className,
  animate = true,
}: {
  value: number;
  precision?: number;
  className?: string;
  animate?: boolean;
}) {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const formatted = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  }).format(safeValue);

  return (
    <AnimatedNumber value={formatted} className={className} animate={animate} />
  );
}
