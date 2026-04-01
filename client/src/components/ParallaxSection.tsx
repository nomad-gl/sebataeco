import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";

interface ParallaxSectionProps {
  /** URL of the background image */
  imageUrl: string;
  /** How strong the parallax is: 0 = no movement, 0.5 = half speed (default), 1 = full speed */
  speed?: number;
  /** Dark overlay opacity, e.g. "bg-black/55" */
  overlayClass?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * A section whose background image moves at a different speed to the page scroll,
 * creating a parallax effect. Works on both desktop and mobile (no CSS
 * `background-attachment: fixed` which is broken on iOS Safari).
 *
 * The background image is rendered as an absolutely-positioned <div> that is
 * translated on the Y axis via `requestAnimationFrame` as the user scrolls.
 */
export default function ParallaxSection({
  imageUrl,
  speed = 0.4,
  overlayClass = "bg-black/55",
  className = "",
  style,
  children,
}: ParallaxSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const bg = bgRef.current;
    if (!section || !bg) return;

    const update = () => {
      const rect = section.getBoundingClientRect();
      // How far the section centre is from the viewport centre
      const viewportH = window.innerHeight;
      const sectionCentreY = rect.top + rect.height / 2;
      const offset = (sectionCentreY - viewportH / 2) * speed;
      bg.style.transform = `translate3d(0, ${offset}px, 0)`;
      rafRef.current = null;
    };

    const onScroll = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(update);
      }
    };

    // Run once on mount to position correctly
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [speed]);

  return (
    <div
      ref={sectionRef}
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {/* Parallax background layer — slightly taller than container so movement
          doesn't reveal empty space at the edges */}
      <div
        ref={bgRef}
        aria-hidden="true"
        className="absolute inset-x-0 will-change-transform pointer-events-none"
        style={{
          top: "-20%",
          bottom: "-20%",
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Colour overlay */}
      <div aria-hidden="true" className={`absolute inset-0 pointer-events-none ${overlayClass}`} />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
