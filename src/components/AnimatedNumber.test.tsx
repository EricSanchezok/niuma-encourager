import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedNumber, MoneyDisplay } from "./AnimatedNumber";

const animate = vi.fn();
let reducedMotion = false;
let motionListener: (() => void) | undefined;

beforeEach(() => {
  reducedMotion = false;
  motionListener = undefined;
  animate
    .mockReset()
    .mockImplementation(() => ({ cancel: vi.fn(), onfinish: null }));
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: reducedMotion,
      addEventListener: (_event: string, listener: () => void) => {
        motionListener = listener;
      },
      removeEventListener: vi.fn(),
    })),
  );
  Element.prototype.animate = animate;
});

describe("AnimatedNumber", () => {
  it("starts at the true value and exposes one accessible value", () => {
    const { container } = render(<MoneyDisplay value={207.5397} />);
    expect(screen.getByRole("img", { name: "¥207.5397" })).toBeInTheDocument();
    expect(container.querySelector(".an-visual")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelector(".an-currency")).toHaveTextContent("¥");
    expect(container.querySelector(".an-fraction")).toBeInTheDocument();
    expect(animate).not.toHaveBeenCalled();
  });

  it("animates only changed digits, including an upward carry from nine to zero", () => {
    const { rerender, container } = render(<AnimatedNumber value="19" />);
    const units = container.querySelectorAll(".an-digit")[1];
    rerender(<AnimatedNumber value="20" />);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[1][0]).toEqual([
      { transform: "translateY(-20.9em)" },
      { transform: "translateY(-22em)" },
    ]);
    expect(container.querySelectorAll(".an-digit")[1]).toBe(units);
    expect(screen.getByRole("img", { name: "20" })).toBeInTheDocument();
  });

  it("rolls countdown digits down through zero to nine", () => {
    const { rerender } = render(
      <AnimatedNumber value="00:00:10" variant="clock" direction="down" />,
    );
    rerender(
      <AnimatedNumber value="00:00:09" variant="clock" direction="down" />,
    );
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[1][0]).toEqual([
      { transform: "translateY(-11em)" },
      { transform: "translateY(-9.9em)" },
    ]);
  });

  it("preserves existing digit slots when a leading digit appears", () => {
    const { rerender, container } = render(<AnimatedNumber value="999" />);
    const units = container.querySelectorAll(".an-digit")[2];
    rerender(<AnimatedNumber value="1,000" />);
    expect(container.querySelectorAll(".an-digit")[3]).toBe(units);
    expect(screen.getByRole("img", { name: "1,000" })).toBeInTheDocument();
  });

  it("keeps a repeated value still", () => {
    const { rerender } = render(<AnimatedNumber value="100.00" />);
    rerender(<AnimatedNumber value="100.00" />);
    expect(animate).not.toHaveBeenCalled();
  });

  it("cancels an active reel when reduced motion is enabled", () => {
    const { rerender } = render(<AnimatedNumber value="1" />);
    rerender(<AnimatedNumber value="2" />);
    const movement = animate.mock.results[0].value;
    reducedMotion = true;
    act(() => motionListener?.());
    expect(movement.cancel).toHaveBeenCalled();
    animate.mockClear();
    rerender(<AnimatedNumber value="3" />);
    expect(animate).not.toHaveBeenCalled();
  });

  it("continues from the visible reel position when an update interrupts motion", () => {
    const { rerender } = render(<AnimatedNumber value="1" />);
    rerender(<AnimatedNumber value="9" />);
    const previousMovement = animate.mock.results[0].value;
    vi.spyOn(globalThis, "getComputedStyle").mockReturnValue({
      transform: "matrix(1, 0, 0, 1, 0, -335.5)",
      fontSize: "20px",
    } as CSSStyleDeclaration);
    rerender(<AnimatedNumber value="0" />);
    expect(previousMovement.cancel).toHaveBeenCalled();
    expect(animate.mock.calls[1][0]).toEqual([
      { transform: "translateY(-16.775em)" },
      { transform: "translateY(-22em)" },
    ]);
  });

  it("cancels motion while hidden and snaps to the newest value after returning", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("visible");
    const clock = vi.spyOn(performance, "now").mockReturnValue(0);
    const { rerender } = render(<AnimatedNumber value="1" />);
    rerender(<AnimatedNumber value="2" />);
    const movement = animate.mock.results[0].value;
    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(movement.cancel).toHaveBeenCalled();
    animate.mockClear();
    rerender(<AnimatedNumber value="5" />);
    expect(animate).not.toHaveBeenCalled();
    clock.mockReturnValue(30_000);
    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    rerender(<AnimatedNumber value="8" />);
    expect(animate).not.toHaveBeenCalled();
    clock.mockReturnValue(32_000);
    rerender(<AnimatedNumber value="9" />);
    expect(animate).toHaveBeenCalledOnce();
    expect(screen.getByRole("img", { name: "9" })).toBeInTheDocument();
  });

  it("shows static values when animation is disabled", () => {
    const { rerender } = render(<AnimatedNumber value="100" animate={false} />);
    rerender(<AnimatedNumber value="200" animate={false} />);
    expect(animate).not.toHaveBeenCalled();
  });

  it("reduces six-digit money before it can overflow a compact window", () => {
    const { rerender } = render(<MoneyDisplay value={123_456.789} />);
    expect(screen.getByRole("img")).toHaveClass("an-number--long");
    rerender(<MoneyDisplay value={1_234_567_890.1234} />);
    expect(screen.getByRole("img")).toHaveClass("an-number--very-long");
  });

  it("keeps the countdown size independent of money sizing thresholds", () => {
    render(<AnimatedNumber value="05:15:24" variant="clock" />);
    expect(screen.getByRole("img")).not.toHaveClass("an-number--long");
    expect(screen.getByRole("img")).not.toHaveClass("an-number--very-long");
  });

  it("sizes very large amounts without reducing their numeric precision", () => {
    render(<MoneyDisplay value={9_007_199_254_740_991} />);
    expect(screen.getByRole("img")).toHaveClass("an-number--very-long");
    expect(screen.getByRole("img")).toHaveAttribute(
      "data-value",
      "¥9,007,199,254,740,991.0000",
    );
  });
});
